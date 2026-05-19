const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { WorkerRunner } = require("./workerRunner");
const updater = require("./updater");
const { loadRules, saveRules } = require("../services/split/ruleManager");
const { getSheetNames, getSheetHeadersWithPosition, getMultipleSheetHeaders, readWorkbook, textValue } = require("../services/split/excelReader");

const DEFAULT_TEMPLATE_NAME = "_default.xlsx";

/**
 * 递归净化数据，移除所有不可 structuredClone 的值
 */
function deepCloneable(obj, seen = new WeakSet()) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (typeof obj === 'function' || typeof obj === 'symbol') return null;
  if (seen.has(obj)) return '[Circular]';
  seen.add(obj);
  if (Array.isArray(obj)) return obj.map(v => deepCloneable(v, seen));
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

function getTemplatesDir() {
  return path.join(app.getPath("userData"), "templates");
}

function getDefaultTemplatePath() {
  return path.join(getTemplatesDir(), DEFAULT_TEMPLATE_NAME);
}

/** Resolve a templateFile value from rules into an absolute path. */
function resolveTemplatePath(templateFile) {
  if (!templateFile) return "";
  if (path.isAbsolute(templateFile)) return templateFile;
  return path.join(getTemplatesDir(), templateFile);
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

  ipcMain.handle("rules:load", async () => {
    const rules = await loadRules({
      projectRoot: getProjectRoot(),
      userDataPath: app.getPath("userData"),
    });
    // Resolve templateFile to an absolute path in userData/templates/
    if (rules.templateFile) {
      rules.templateFile = resolveTemplatePath(rules.templateFile);
    }
    return rules;
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
          const result = await getSheetNames(filePath);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });

    setCachedSheetNames(filePath, names);
    return names;
  });

  /** List all templates in userData/templates/. */
  ipcMain.handle("template:list", async () => {
    const templatesDir = getTemplatesDir();
    let files;
    try {
      files = await fs.readdir(templatesDir);
    } catch {
      return [];
    }

    const items = [];
    for (const name of files) {
      if (!name.endsWith(".xlsx")) continue;
      const fullPath = path.join(templatesDir, name);
      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }
      items.push({
        name,
        path: fullPath,
        isDefault: name === DEFAULT_TEMPLATE_NAME,
        mtime: stat.mtime.toISOString(),
        size: stat.size,
      });
    }

    // Sort: default first, then by mtime descending
    items.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return b.mtime.localeCompare(a.mtime);
    });

    return items;
  });

  /** Import a new template file into userData/templates/. */
  ipcMain.handle("template:import", async (_, sourcePath) => {
    const templatesDir = getTemplatesDir();
    await fs.mkdir(templatesDir, { recursive: true });
    const baseName = path.basename(sourcePath);
    const destPath = path.join(templatesDir, baseName);

    // Avoid overwriting the default
    if (baseName === DEFAULT_TEMPLATE_NAME) {
      throw new Error("Cannot overwrite the default template.");
    }

    await fs.copyFile(sourcePath, destPath);
    return {
      name: baseName,
      path: destPath,
      isDefault: false,
    };
  });

  /** Delete a user-uploaded template (default template cannot be deleted). */
  ipcMain.handle("template:delete", async (_, templateName) => {
    if (templateName === DEFAULT_TEMPLATE_NAME) {
      throw new Error("The default template cannot be deleted.");
    }
    const filePath = path.join(getTemplatesDir(), templateName);
    await fs.unlink(filePath);
    return { deleted: true };
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
      const { inputDir, templateFile, rules: incoming } = payload || {};
      if (!inputDir || !templateFile || !Array.isArray(incoming) || incoming.length === 0) {
        return { rules: [] };
      }

      const prog = (pct, stage) => {
        try { broadcast({ type: "progress", taskId: "preload-headers", progress: pct, stage }); } catch {}
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
        templateHeadersBySheet = await getMultipleSheetHeaders(templateFile, templateConfigs);
      } catch {
        templateHeadersBySheet = {};
      }

      // 2. 扫描数据目录
      prog(15, "扫描数据目录...");
      let entries = [];
      try { entries = await fs.readdir(inputDir, { withFileTypes: true }); } catch { entries = []; }
      const allFiles = entries
        .filter((e) => e.isFile())
        .map((e) => path.join(inputDir, e.name))
        .filter((fp) => fp.toLowerCase().endsWith(".xlsx"))
        .filter((fp) => !path.basename(fp).startsWith("~$"))
        .filter((fp) => path.resolve(fp) !== path.resolve(templateFile));

      if (allFiles.length === 0) {
        prog(100, "未找到源文件");
        return { rules: incoming.map((r) => ({ sheetName: r.sheetName, outputSheetName: r.outputSheetName, headerRows: r.headerRows, preloadedHeaders: { templateHeaders: templateHeadersBySheet[r.outputSheetName || r.sheetName] || [], sources: [] } })) };
      }

      // 3. 8个一批并发读每个源文件——读列头+读供应商数据
      const CONCURRENCY = 8;
      const fileResults = [];
      let processedCount = 0;

      async function processFile(filePath) {
        try {
          const configs = incoming.map((r) => ({
            sheetName: r.sheetName,
            headerRows: r.headerRows || 1,
          }));
          const headersMap = await getMultipleSheetHeaders(filePath, configs);
          const hasData = Object.values(headersMap).some(
            (arr) => arr.length > 0 && arr.some((h) => h !== null)
          );
          if (!hasData) return null;

          // 读每个 sheet 的供应商列，收集供应商名
          const vendorsBySheet = {};
          const wb = await readWorkbook(filePath);
          for (const rule of incoming) {
            const sheet = wb.getWorksheet(rule.sheetName);
            if (!sheet) continue;
            const colIndex = (function(l){return[...l.toUpperCase()].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)})(rule.splitColumn||"C");
            const vendors = new Set();
            for (let r = (rule.headerRows || 1) + 1; r <= sheet.rowCount; r++) {
              const cell = sheet.getRow(r).getCell(colIndex);
              // 跳过公式对象但没有缓存结果的单元格（避免 [object Object]）
              const cv = cell.value;
              if (cv && typeof cv === 'object' && !Object.prototype.hasOwnProperty.call(cv, 'result') && !Object.prototype.hasOwnProperty.call(cv, 'text') && !Object.prototype.hasOwnProperty.call(cv, 'richText') && !Object.prototype.hasOwnProperty.call(cv, 'error')) continue;
              const v = textValue(cv).trim();
              if (v) vendors.add(v);
            }
            if (vendors.size > 0) vendorsBySheet[rule.sheetName] = [...vendors];
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
              headers: headers.map((h) => (h === null || h === undefined ? null : String(h))),
            });
          } else {
            // 每个供应商一行
            for (const vendor of vendors) {
              sources.push({
                file: vendor,
                headers: headers.map((h) => (h === null || h === undefined ? null : String(h))),
              });
            }
          }
        }
        return {
          sheetName: String(rule.sheetName || ""),
          outputSheetName: String(key),
          headerRows: Number(rule.headerRows || 1),
          preloadedHeaders: {
            templateHeaders: (templateHeaders || []).map((h) => (h === null || h === undefined ? null : String(h))),
            sources,
          },
        };
      });

      prog(100, "预读取完成");
      return { rules: resultRules };
    } catch (err) {
      console.error("preload-headers error:", err?.message || err);
      try { broadcast({ type: "progress", taskId: "preload-headers", progress: 100, stage: "读取失败" }); } catch {}
      return { rules: [] };
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
}

module.exports = {
  registerIpcHandlers,
};
