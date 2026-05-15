const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('excelToolsApi', {
  selectFile: () => ipcRenderer.invoke('file:select'),
  selectOutputDir: () => ipcRenderer.invoke('dir:select'),
  selectRulesPath: () => ipcRenderer.invoke('rules:selectPath'),
  getRules: (payload) => ipcRenderer.invoke('rules:get', payload),
  saveRules: (payload) => ipcRenderer.invoke('rules:save', payload),
  resetDefaultRules: () => ipcRenderer.invoke('rules:resetDefault'),
  runSplit: (payload) => ipcRenderer.invoke('split:run', payload),
  onSplitLog: (callback) => ipcRenderer.on('split:log', (_event, message) => callback(message))
});
