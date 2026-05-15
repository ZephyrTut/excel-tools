const { dialog, ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const { runSplitTask } = require('../services/split/splitService');

const taskCache = new Map();

function sendLog(taskId, message) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('split:log', { taskId, message });
  });
}

function sendTaskUpdate(task) {
  const payload = {
    taskId: task.taskId,
    status: task.status,
    progress: task.progress,
    result: task.result,
    error: task.error,
    updatedAt: task.updatedAt
  };
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send('split:task-update', payload);
  });
}

function updateTask(taskId, patch) {
  const current = taskCache.get(taskId);
  if (!current) return;
  const next = { ...current, ...patch, updatedAt: Date.now() };
  taskCache.set(taskId, next);
  sendTaskUpdate(next);
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
    const taskId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rulesPath = path.join(__dirname, '..', 'config', 'defaultRules.json');
    const baseTask = {
      taskId,
      status: 'pending',
      progress: { percent: 0, stage: 'pending', message: '任务已创建' },
      result: null,
      error: null,
      worker: null,
      updatedAt: Date.now()
    };
    taskCache.set(taskId, baseTask);
    sendTaskUpdate(baseTask);

    try {
      updateTask(taskId, { status: 'running' });
      const result = await runSplitTask({
        ...payload,
        rulesPath,
        onLog: (message) => sendLog(taskId, message),
        onProgress: (progress) => updateTask(taskId, { progress }),
        onStateChange: (status) => updateTask(taskId, { status }),
        onWorker: (worker) => updateTask(taskId, { worker })
      });

      const task = taskCache.get(taskId);
      if (task && task.status === 'canceled') {
        return { taskId, success: false, canceled: true, error: '任务已取消' };
      }

      updateTask(taskId, {
        status: result.success ? 'success' : 'failed',
        result,
        error: result.error || null,
        worker: null
      });
      return { taskId, ...result };
    } catch (error) {
      updateTask(taskId, { status: 'failed', error: error.message, worker: null });
      return { taskId, success: false, error: error.message };
    }
  });

  ipcMain.handle('split:cancel', async (_event, taskId) => {
    const task = taskCache.get(taskId);
    if (!task) return { success: false, error: '任务不存在' };
    if (!task.worker || task.status !== 'running') return { success: false, error: '任务不可取消' };

    await task.worker.terminate();
    updateTask(taskId, {
      status: 'canceled',
      error: '用户取消任务',
      progress: { ...(task.progress || {}), message: '任务已取消' },
      worker: null
    });
    return { success: true, taskId };
  });
}

module.exports = { registerIpcHandlers };
