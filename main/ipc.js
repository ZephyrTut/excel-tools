const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const crypto = require("node:crypto");
const { WorkerRunner } = require("./workerRunner");
const updater = require("./updater");
const { loadRules, saveRules } = require("../services/split/ruleManager");
const templateStore = require("../services/templateStore");
const { resolveSheetName } = require("../services/split/sheetNameMatcher");
const sendService = require("../services/send/sendService");

/** Lazy getters — these modules are heavy and only needed on first IPC call. */
function excelReader() {
  return require("../services/split/excelReader");
}

/**
 * 递归净化数据，移除所有不可 structuredClone 的值
 */
function deepCloneable(obj, seen = new WeakSet()) {
  if (obj === null || obj === undefined) return null;
  if (
    typeof obj === "string" ||
    typeof obj === "number" ||
    typeof obj === "boolean"
  )
    return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (typeof obj === "function" || typeof obj === "symbol") return null;
  if (seen.has(obj)) return "[Circular]";
  seen.add(obj);
  if (Array.isArray(obj)) return obj.map((v) => deepCloneable(v, seen));
  if (obj instanceof Date) return obj.toISOString();
  if (obj instanceof Map) return Object.fromEntries(obj);
  if (obj instanceof Set) return [...obj];
  const result = {};
  for (const key of Object.keys(obj)) {
    result[key] = deepCloneable(obj[key], seen);
  }
  return result;
}

// ── Sheet name cache (避免重复读取整份 Excel) ──────────────────
const sheetNameCache = new Map();
const CACHE_TTL_MS = 30_000; // 30 秒

function getCachedSheetNames(filePath) {
  const entry = sheetNameCache.get(filePath);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.names;
  }
  return null;
}

function setCachedSheetNames(filePath, names) {
  sheetNameCache.set(filePath, { names, timestamp: Date.now() });
  // 清理过期缓存，避免内存泄漏
  if (sheetNameCache.size > 50) {
    const now = Date.now();
    for (const [key, val] of sheetNameCache) {
      if (now - val.timestamp > CACHE_TTL_MS) sheetNameCache.delete(key);
    }
  }
}

const runner = new WorkerRunner();
function getProjectRoot() {
  return app.getAppPath();
}

function broadcast(event) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("task:event", event);
  }
}

runner.on("event", broadcast);

function registerIpcHandlers() {
  ipcMain.handle("dialog:select-input-file", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择源 Excel 文件",
      properties: ["openFile"],
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
    };
  });

  ipcMain.handle("dialog:select-template-file", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择模板 Excel 文件",
      properties: ["openFile"],
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
    };
  });

  ipcMain.handle("dialog:select-output-dir", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择输出目录",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("dialog:select-send-folder", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择待发送文件所在文件夹",
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("rules:load", async () => {
    return loadRules({
      projectRoot: getProjectRoot(),
      userDataPath: app.getPath("userData"),
    });
  });

  ipcMain.handle("rules:save", async (_, rules) => {
    return saveRules(rules, {
      userDataPath: app.getPath("userData"),
    });
  });

  ipcMain.handle("rules:get-defaults", async () => {
    const configPath = path.join(
      getProjectRoot(),
      "config",
      "defaultRules.json"
    );
    const raw = await fs.readFile(configPath, "utf-8");
    return JSON.parse(raw);
  });

  // ── Template management ──────────────────────────────────────────

  ipcMain.handle("file:get-sheet-names", async (_, filePath) => {
    // 缓存命中 → 不进 ExcelJS，不阻塞主进程
    const cached = getCachedSheetNames(filePath);
    if (cached) return cached;

    // 使用 setImmediate 让事件循环先处理 UI 渲染，再开始 Excel 读取
    const names = await new Promise((resolve, reject) => {
      setImmediate(async () => {
        try {
          const result = await excelReader().getSheetNames(filePath);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });

    setCachedSheetNames(filePath, names);
    return names;
  });

  ipcMain.handle("file:get-info", async (_, filePath) => {
    const stat = await fs.stat(filePath);
    return { path: filePath, name: path.basename(filePath), size: stat.size };
  });

  ipcMain.handle(
    "file:get-directory-sheet-names",
    async (_, inputDir, excludedPaths = []) => {
      if (!inputDir) return [];
      let entries = [];
      try {
        entries = await fs.readdir(inputDir, { withFileTypes: true });
      } catch {
        return [];
      }

      const excluded = new Set(
        (excludedPaths || []).filter(Boolean).map((item) => path.resolve(item))
      );
      const sheetNames = new Set();
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const filePath = path.join(inputDir, entry.name);
        if (!filePath.toLowerCase().endsWith(".xlsx")) continue;
        if (path.basename(filePath).startsWith("~$")) continue;
        if (excluded.has(path.resolve(filePath))) continue;
        try {
          const names = await excelReader().getSheetNames(filePath);
          for (const name of names) sheetNames.add(name);
        } catch {
          // ignore individual unreadable files during option discovery
        }
      }

      return [...sheetNames];
    }
  );

  /** List all templates for a scope. */
  ipcMain.handle("template:list", async (_, scope) => {
    return templateStore.listTemplates(app.getPath("userData"), scope);
  });

  /** Import a new template file into a scope-specific directory. */
  ipcMain.handle("template:import", async (_, scope, sourcePath) => {
    return templateStore.importTemplate(
      app.getPath("userData"),
      scope,
      sourcePath
    );
  });

  /** Delete a template file from a scope-specific directory. */
  ipcMain.handle("template:delete", async (_, scope, templateName) => {
    return templateStore.deleteTemplate(
      app.getPath("userData"),
      scope,
      templateName
    );
  });

  ipcMain.handle("task:start-split", async (_, payload) => {
    const taskId = crypto.randomUUID();
    const request = {
      ...payload,
      projectRoot: getProjectRoot(),
      userDataPath: app.getPath("userData"),
    };
    runner.startSplitTask(taskId, request);
    return { taskId };
  });

  ipcMain.handle("task:start-merge", async (_, payload) => {
    const taskId = crypto.randomUUID();
    const request = {
      ...payload,
      projectRoot: getProjectRoot(),
      userDataPath: app.getPath("userData"),
    };
    runner.startMergeTask(taskId, request);
    return { taskId };
  });

  ipcMain.handle("task:cancel", async (_, taskId) => {
    const cancelled = await runner.cancelTask(taskId);
    return { cancelled };
  });

  // ── Merge preload headers ──────

  ipcMain.handle("merge:preload-headers", async (_, payload) => {
    try {
      const {
        inputDir,
        templateFile,
        orderSheetName,
        orderColumn,
        sheetNameAliases,
        rules: incoming,
      } = payload || {};
      if (
        !inputDir ||
        !templateFile ||
        !Array.isArray(incoming) ||
        incoming.length === 0
      ) {
        return { rules: [] };
      }

      const prog = (pct, stage) => {
        try {
          broadcast({
            type: "progress",
            taskId: "preload-headers",
            progress: pct,
            stage,
          });
        } catch {}
      };

      prog(5, "开始预读取...");

      // 1. 读模板所有规则的列头（只打开模板 1 次）
      prog(10, "读取模板列头...");
      const templateConfigs = incoming.map((r) => ({
        sheetName: r.outputSheetName || r.sheetName,
        headerRows: r.headerRows || 1,
      }));
      let templateHeadersBySheet = {};
      try {
        templateHeadersBySheet = await excelReader().getMultipleSheetHeaders(
          templateFile,
          templateConfigs
        );
      } catch {
        templateHeadersBySheet = {};
      }

      // 2. 扫描数据目录
      prog(15, "扫描数据目录...");
      let entries = [];
      try {
        entries = await fs.readdir(inputDir, { withFileTypes: true });
      } catch {
        entries = [];
      }
      const allFiles = entries
        .filter((e) => e.isFile())
        .map((e) => path.join(inputDir, e.name))
        .filter((fp) => fp.toLowerCase().endsWith(".xlsx"))
        .filter((fp) => !path.basename(fp).startsWith("~$"))
        .filter((fp) => path.resolve(fp) !== path.resolve(templateFile));

      if (allFiles.length === 0) {
        prog(100, "未找到源文件");
        return deepCloneable({
          rules: incoming.map((r) => ({
            sheetName: r.sheetName,
            outputSheetName: r.outputSheetName,
            headerRows: r.headerRows,
            preloadedHeaders: {
              templateHeaders:
                templateHeadersBySheet[r.outputSheetName || r.sheetName] || [],
              sources: [],
            },
          })),
        });
      }

      // 3. 8个一批并发读每个源文件——读列头+读供应商数据
      const CONCURRENCY = 8;
      const fileResults = [];
      let processedCount = 0;

      async function processFile(filePath) {
        try {
          const wb = await excelReader().readWorkbook(filePath);
          const actualSheetNames = wb.worksheets.map((sheet) => sheet.name);
          const headersMap = {};
          for (const rule of incoming) {
            const resolved = resolveSheetName(
              rule.sheetName,
              actualSheetNames,
              sheetNameAliases || {}
            );
            const worksheet = resolved.matchedSheetName
              ? wb.getWorksheet(resolved.matchedSheetName)
              : null;
            headersMap[rule.sheetName] = worksheet
              ? excelReader().getHeadersFromWorksheet(
                  worksheet,
                  rule.headerRows || 1
                )
              : [];
          }
          const hasData = Object.values(headersMap).some(
            (arr) => arr.length > 0 && arr.some((h) => h !== null)
          );
          if (!hasData) return null;

          // 统一用排序依据 Sheet 的排序列取供应商名
          const vendorsBySheet = {};
          const resolvedOrderSheet = resolveSheetName(
            orderSheetName || incoming[0]?.sheetName,
            actualSheetNames,
            sheetNameAliases || {}
          );
          const orderSheet = resolvedOrderSheet.matchedSheetName
            ? wb.getWorksheet(resolvedOrderSheet.matchedSheetName)
            : null;
          if (orderSheet) {
            const colIndex = (function (l) {
              return [...l.toUpperCase()].reduce(
                (a, c) => a * 26 + c.charCodeAt(0) - 64,
                0
              );
            })(orderColumn || incoming[0]?.splitColumn || "C");
            const vendors = new Set();
            const orderHeaderRows =
              incoming.find((r) => r.sheetName === orderSheetName)
                ?.headerRows || 1;
            for (let r = orderHeaderRows + 1; r <= orderSheet.rowCount; r++) {
              const cell = orderSheet.getRow(r).getCell(colIndex);
              const cv = cell.value;
              if (
                cv &&
                typeof cv === "object" &&
                !Object.prototype.hasOwnProperty.call(cv, "result") &&
                !Object.prototype.hasOwnProperty.call(cv, "text") &&
                !Object.prototype.hasOwnProperty.call(cv, "richText") &&
                !Object.prototype.hasOwnProperty.call(cv, "error")
              )
                continue;
              const v = excelReader().textValue(cv).trim();
              if (v) vendors.add(v);
            }
            if (vendors.size > 0) {
              for (const rule of incoming) {
                vendorsBySheet[rule.sheetName] = [...vendors];
              }
            }
          }
          return {
            file: path.basename(filePath),
            headersBySheet: headersMap,
            vendorsBySheet,
          };
        } catch {
          return null;
        }
      }

      for (let i = 0; i < allFiles.length; i += CONCURRENCY) {
        const chunk = allFiles.slice(i, i + CONCURRENCY);
        const chunkResults = await Promise.all(chunk.map(processFile));
        for (const result of chunkResults) {
          if (result) fileResults.push(result);
        }
        processedCount += chunk.length;
        const pct = 15 + Math.round((processedCount / allFiles.length) * 75);
        prog(pct, `正在读取 (${processedCount}/${allFiles.length})`);
      }

      // 4. 按规则维度重组——每个供应商一行
      prog(92, "整理数据...");
      const resultRules = incoming.map((rule) => {
        const key = rule.outputSheetName || rule.sheetName;
        const templateHeaders = templateHeadersBySheet[key] || [];
        const sources = [];
        for (const fr of fileResults) {
          const headers = fr.headersBySheet[rule.sheetName];
          if (!headers || headers.length === 0) continue;
          const vendors = fr.vendorsBySheet?.[rule.sheetName] || [];
          if (vendors.length === 0) {
            // 没有供应商数据，用文件名
            sources.push({
              file: fr.file,
              headers: headers.map((h) =>
                h === null || h === undefined ? null : String(h)
              ),
            });
          } else {
            // 每个供应商一行
            for (const vendor of vendors) {
              sources.push({
                file: vendor,
                headers: headers.map((h) =>
                  h === null || h === undefined ? null : String(h)
                ),
              });
            }
          }
        }
        return {
          sheetName: String(rule.sheetName || ""),
          outputSheetName: String(key),
          headerRows: Number(rule.headerRows || 1),
          preloadedHeaders: {
            templateHeaders: (templateHeaders || []).map((h) =>
              h === null || h === undefined ? null : String(h)
            ),
            sources,
          },
        };
      });

      prog(100, "预读取完成");
      return deepCloneable({ rules: resultRules });
    } catch (err) {
      console.error("preload-headers error:", err?.message || err);
      try {
        broadcast({
          type: "progress",
          taskId: "preload-headers",
          progress: 100,
          stage: "读取失败",
        });
      } catch {}
      return deepCloneable({ rules: [] });
    }
  });

  // ── Auto-update ──────────────────────────────────────────────────

  ipcMain.handle("update:check", async () => {
    return updater.checkForUpdates();
  });

  ipcMain.handle("update:download", () => {
    updater.downloadUpdate();
  });

  ipcMain.handle("update:install", () => {
    updater.installUpdate();
  });

  // ── Compress (XLSX ZIP/XML level optimization) ────────────────────

  ipcMain.handle("compress:pick-dir", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择包含 Excel 文件的文件夹",
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const dirPath = result.filePaths[0];
    return { path: dirPath, name: path.basename(dirPath) };
  });

  ipcMain.handle("compress:run", async (_, request) => {
    const taskId = crypto.randomUUID();

    broadcast({ type: "log", taskId, level: "info", message: "压缩任务已提交至后台处理" });

    // Start Worker
    runner.startCompressTask(taskId, request);

    // Return taskId immediately; results come via task:event
    return { taskId };
  });

  ipcMain.handle("compress:list-dir", async (_, dirPath) => {
    const walkDir = require("node:fs");
    const results = [];

    function walk(dir) {
      for (const entry of walkDir.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...walk(fullPath));
        } else if (entry.isFile() && /\.xlsx$/i.test(entry.name)) {
          const stat = walkDir.statSync(fullPath);
          results.push({
            path: fullPath,
            name: entry.name,
            relative: path.relative(dirPath, fullPath),
            size: stat.size,
          });
        }
      }
      return results;
    }

    try {
      return walk(dirPath);
    } catch (err) {
      return [];
    }
  });

  // ── Send Tool ──────────────────────────────────────────────────────

  ipcMain.handle("send:import-rules", async (_, filePath) => {
    return sendService.importRules(filePath, app.getPath("userData"));
  });

  ipcMain.handle("send:get-rules", async () => {
    return sendService.getRules(app.getPath("userData"));
  });

  ipcMain.handle("send:match-files", async (_, folderPath) => {
    return sendService.matchFolderFiles(folderPath, app.getPath("userData"));
  });

  ipcMain.handle("send:send", async (_, payload) => {
    const { matched, wechatFirst } = payload || {};
    const result = await sendService.executeSend({
      matched,
      wechatFirst,
      userDataPath: app.getPath("userData"),
      onProgress: (event) => {
        const safeEvent = deepCloneable({ ...event, taskId: "send" });
        try {
          if (typeof structuredClone === "function") structuredClone(safeEvent);
          broadcast(safeEvent);
        } catch (err) {
          console.warn("send progress broadcast skipped:", err?.message || err);
        }
      },
    });
    return deepCloneable({
      results: result.results,
      successCount: result.successCount,
      failCount: result.failCount,
    });
  });

  ipcMain.handle("send:get-history", async () => {
    return sendService.loadHistory(app.getPath("userData"));
  });

  ipcMain.handle("send:clear-history", async () => {
    await sendService.clearHistory(app.getPath("userData"));
    return { success: true };
  });

  ipcMain.handle("send:get-smtp-config", async () => {
    return sendService.getSmtpConfig(app.getPath("userData"));
  });

  ipcMain.handle("send:save-smtp-config", async (_, config) => {
    await sendService.saveSmtpConfig(app.getPath("userData"), config);
    return { success: true };
  });

  ipcMain.handle("send:list-folder-files", async (_, folderPath) => {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      const files = entries
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((n) => n.toLowerCase().endsWith(".xlsx"))
        .filter((n) => !n.startsWith("~$"));
      return { files };
    } catch (e) {
      return { files: [], error: e.message };
    }
  });

  ipcMain.handle("send:export-results", async (_, data) => {
    const result = await dialog.showSaveDialog({
      title: "导出发送结果",
      defaultPath: `发送结果_${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: "CSV 文件", extensions: ["csv"] }],
    });
    if (result.canceled || !result.filePath)
      return { success: false, error: "已取消" };

    const { headers, rows } = data || {};
    if (!Array.isArray(headers) || !Array.isArray(rows)) {
      return { success: false, error: "数据无效" };
    }

    const csvContent = [
      headers.join(","),
      ...rows.map((r) =>
        r
          .map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\r\n");

    // BOM 让 Excel 正确识别 UTF-8 中文
    await fs.writeFile(result.filePath, "﻿" + csvContent, "utf-8");
    return { success: true };
  });
}

module.exports = {
  registerIpcHandlers,
};
