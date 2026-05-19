const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { WorkerRunner } = require("./workerRunner");
const updater = require("./updater");
const { loadRules, saveRules } = require("../services/split/ruleManager");
const { getSheetNames, getSheetHeadersWithPosition } = require("../services/split/excelReader");

const DEFAULT_TEMPLATE_NAME = "_default.xlsx";

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

  // ── Merge preload headers (一次性预读取所有标题行) ────────────

  ipcMain.handle("merge:preload-headers", async (_, payload) => {
    const { inputDir, templateFile, rules } = payload || {};
    if (!inputDir || !templateFile || !Array.isArray(rules) || rules.length === 0) {
      return { rules: [] };
    }

    // 逐 rule 处理：读模板列头 + 读所有子表该 sheet 的列头
    for (const rule of rules) {
      const key = rule.outputSheetName || rule.sheetName;
      if (!key) continue;

      // 读模板列头
      let templateHeaders = [];
      try {
        templateHeaders = await getSheetHeadersWithPosition(templateFile, key, rule.headerRows || 1);
      } catch {
        templateHeaders = [];
      }

      // 子表目录
      let entries = [];
      try {
        entries = await fs.readdir(inputDir, { withFileTypes: true });
      } catch {
        entries = [];
      }
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => path.join(inputDir, entry.name))
        .filter((fp) => fp.toLowerCase().endsWith(".xlsx"))
        .filter((fp) => !path.basename(fp).startsWith("~$"))
        .filter((fp) => path.resolve(fp) !== path.resolve(templateFile));

      // 读每个子表该 sheet 的列头
      const sources = [];
      for (const filePath of files) {
        try {
          const headers = await getSheetHeadersWithPosition(filePath, rule.sheetName, rule.headerRows || 1);
          if (headers.some((h) => h !== null)) {
            sources.push({ file: path.basename(filePath), headers });
          }
        } catch {
          // 跳过无法读取的文件
        }
      }

      rule.preloadedHeaders = { templateHeaders, sources };
    }

    return { rules };
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
