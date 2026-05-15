const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('excelToolsApi', {
  selectFile: () => ipcRenderer.invoke('file:select'),
  selectOutputDir: () => ipcRenderer.invoke('dir:select'),
  runSplit: (payload) => ipcRenderer.invoke('split:run', payload),
  cancelSplit: (taskId) => ipcRenderer.invoke('split:cancel', taskId),
  onSplitLog: (callback) => ipcRenderer.on('split:log', (_event, payload) => callback(payload)),
  onTaskUpdate: (callback) => ipcRenderer.on('split:task-update', (_event, payload) => callback(payload))
});
