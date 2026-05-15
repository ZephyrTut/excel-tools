const { dialog, ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { runSplitTask } = require('../services/split/splitService');

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
    const rulesPath = path.join(__dirname, '..', 'config', 'defaultRules.json');
    const result = await runSplitTask({ ...payload, rulesPath, onLog: sendLog });
    if (!result.success && result.error && typeof result.error === 'string') {
      return { ...result, error: { code: 'UNKNOWN_ERROR', message: result.error, detail: {} } };
    }
    return result;
  });
}

module.exports = { registerIpcHandlers };
