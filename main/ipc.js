const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { WorkerRunner } = require("./workerRunner");
const updater = require("./updater");
const { loadRules, saveRules } = require("../services/split/ruleManager");
const { getSheetNames } = require("../services/split/excelReader");

const DEFAULT_TEMPLATE_NAME = "_default.xlsx";

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
    return getSheetNames(filePath);
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
