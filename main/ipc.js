const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { WorkerRunner } = require("./workerRunner");
const {
  loadRules,
  saveRules
} = require("../split/ruleManager");

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
      filters: [{ name: "Excel", extensions: ["xlsx"] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size
    };
  });

  ipcMain.handle("dialog:select-template-file", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择模板 Excel 文件",
      properties: ["openFile"],
      filters: [{ name: "Excel", extensions: ["xlsx"] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size
    };
  });

  ipcMain.handle("dialog:select-output-dir", async () => {
    const result = await dialog.showOpenDialog({
      title: "选择输出目录",
      properties: ["openDirectory", "createDirectory"]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("rules:load", async () => {
    return loadRules({
      projectRoot: getProjectRoot(),
      userDataPath: app.getPath("userData")
    });
  });

  ipcMain.handle("rules:save", async (_, rules) => {
    return saveRules(rules, {
      userDataPath: app.getPath("userData")
    });
  });

  ipcMain.handle("rules:get-defaults", async () => {
    const configPath = path.join(getProjectRoot(), "config", "defaultRules.json");
    const raw = await fs.readFile(configPath, "utf-8");
    return JSON.parse(raw);
  });

  ipcMain.handle("task:start-split", async (_, payload) => {
    const taskId = crypto.randomUUID();
    const request = {
      ...payload,
      projectRoot: getProjectRoot(),
      userDataPath: app.getPath("userData")
    };
    runner.startSplitTask(taskId, request);
    return { taskId };
  });

  ipcMain.handle("task:cancel", async (_, taskId) => {
    const cancelled = await runner.cancelTask(taskId);
    return { cancelled };
  });
}

module.exports = {
  registerIpcHandlers
};
