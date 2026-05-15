const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('excelToolsApi', {
  selectFile: () => ipcRenderer.invoke('file:select'),
  selectOutputDir: () => ipcRenderer.invoke('dir:select'),
  getRules: () => ipcRenderer.invoke('rules:get'),
  saveRules: (payload) => ipcRenderer.invoke('rules:save', payload),
  preflightSplit: (payload) => ipcRenderer.invoke('split:preflight', payload),
  runSplit: (payload) => ipcRenderer.invoke('split:run', payload),
  getLastTaskReport: () => ipcRenderer.invoke('task-report:get-last'),
  onSplitLog: (callback) => ipcRenderer.on('split:log', (_event, message) => callback(message))
});
