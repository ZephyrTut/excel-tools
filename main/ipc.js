const { dialog, ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { Worker } = require('worker_threads');

function sendLog(message) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('split:log', message);
  });
}

function runSplitInWorker(payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '..', 'services', 'split', 'splitWorker.js'), {
      workerData: payload
    });

    worker.on('message', (msg) => {
      if (msg.type === 'log') sendLog(msg.message);
      if (msg.type === 'done') resolve(msg.result);
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
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
    return runSplitInWorker({ ...payload, rulesPath });
  });
}

module.exports = { registerIpcHandlers };
