const { dialog, ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { runSplitTask } = require('../services/split/splitService');
const { loadRules, saveRules, validateRules } = require('../services/common/ruleManager');

const rulesPath = path.join(__dirname, '..', 'config', 'defaultRules.json');
let lastTaskReport = null;

function sendLog(message) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('split:log', message);
  });
}

function registerIpcHandlers() {
  ipcMain.handle('file:select', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    return { path: filePath, name: path.basename(filePath), size: stat.size };
  });

  ipcMain.handle('dir:select', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('rules:get', async () => loadRules(rulesPath));

  ipcMain.handle('rules:save', async (_event, payload) => {
    const check = validateRules(payload);
    if (!check.valid) return { success: false, errors: check.errors };
    await saveRules(rulesPath, payload);
    return { success: true };
  });

  ipcMain.handle('split:preflight', async (_event, payload) => {
    const errors = [];
    if (!payload?.sourceFile) errors.push('未选择源文件');
    if (!payload?.outputDir) errors.push('未选择输出目录');

    const rules = await loadRules(rulesPath);
    const ruleCheck = validateRules(rules);
    if (!ruleCheck.valid) {
      errors.push(...ruleCheck.errors.map((msg) => `规则配置错误: ${msg}`));
    }

    try {
      if (payload?.sourceFile) await fs.access(payload.sourceFile);
    } catch (_e) {
      errors.push('源文件不可访问');
    }

    return { success: errors.length === 0, errors };
  });

  ipcMain.handle('split:run', async (_event, payload) => {
    const result = await runSplitTask({ ...payload, rulesPath, onLog: sendLog });
    lastTaskReport = {
      runAt: new Date().toISOString(),
      sourceFile: payload?.sourceFile,
      outputDir: payload?.outputDir,
      ...result
    };
    return result;
  });

  ipcMain.handle('task-report:get-last', async () => lastTaskReport);
}

module.exports = { registerIpcHandlers };
