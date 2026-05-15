const { dialog, ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { runSplitTask } = require('../services/split/splitService');
const { loadRules, saveRules } = require('../services/common/ruleManager');

const defaultRulesPath = path.join(__dirname, '..', 'config', 'defaultRules.json');
let activeRulesPath = defaultRulesPath;

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

  ipcMain.handle('split:run', async (_event, payload) => {
    const rulesPath = payload.rulesPath || activeRulesPath;
    return runSplitTask({ ...payload, rulesPath, onLog: sendLog });
  });

  ipcMain.handle('rules:selectPath', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    activeRulesPath = result.filePaths[0];
    return activeRulesPath;
  });

  ipcMain.handle('rules:get', async (_event, payload = {}) => {
    const targetPath = payload.path || activeRulesPath;
    activeRulesPath = targetPath;
    const rules = await loadRules(targetPath);
    return { path: targetPath, rules };
  });

  ipcMain.handle('rules:save', async (_event, payload = {}) => {
    const targetPath = payload.path || activeRulesPath;
    activeRulesPath = targetPath;
    const rules = await saveRules(targetPath, payload.rules || {});
    return { path: targetPath, rules };
  });

  ipcMain.handle('rules:resetDefault', async () => {
    activeRulesPath = defaultRulesPath;
    const rules = await loadRules(defaultRulesPath);
    return { path: defaultRulesPath, rules };
  });
}

module.exports = { registerIpcHandlers };
