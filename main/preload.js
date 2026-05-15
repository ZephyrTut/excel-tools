const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('excelToolsApi', {
  selectFile: () => ipcRenderer.invoke('file:select'),
  selectOutputDir: () => ipcRenderer.invoke('dir:select'),
  runSplit: (payload) => ipcRenderer.invoke('split:run', payload),
  onSplitLog: (callback) => ipcRenderer.on('split:log', (_event, message) => callback(message))
});
