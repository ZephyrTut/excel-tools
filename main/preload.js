const { contextBridge, ipcRenderer } = require("electron");

const api = {
  selectInputFile: () => ipcRenderer.invoke("dialog:select-input-file"),
  selectTemplateFile: () => ipcRenderer.invoke("dialog:select-template-file"),
  selectOutputDir: () => ipcRenderer.invoke("dialog:select-output-dir"),
  selectOptimizeFile: () => ipcRenderer.invoke("dialog:select-optimize-file"),
  getFileInfo: (filePath) => ipcRenderer.invoke("file:get-info", filePath),
  getSheetNames: (filePath) => ipcRenderer.invoke("file:get-sheet-names", filePath),
  preloadMergeHeaders: (payload) => ipcRenderer.invoke("merge:preload-headers", payload),
  loadRules: () => ipcRenderer.invoke("rules:load"),
  getDefaultRules: () => ipcRenderer.invoke("rules:get-defaults"),
  saveRules: (rules) => ipcRenderer.invoke("rules:save", rules),
  startSplitTask: (payload) => ipcRenderer.invoke("task:start-split", payload),
  startMergeTask: (payload) => ipcRenderer.invoke("task:start-merge", payload),
  cancelTask: (taskId) => ipcRenderer.invoke("task:cancel", taskId),
  listTemplates: () => ipcRenderer.invoke("template:list"),
  importTemplate: (sourcePath) => ipcRenderer.invoke("template:import", sourcePath),
  deleteTemplate: (name) => ipcRenderer.invoke("template:delete", name),
  runOptimize: (filePath) => ipcRenderer.invoke("optimize:run", filePath),
  saveOptimizedFile: (tempPath) => ipcRenderer.invoke("optimize:save", tempPath),
  onTaskEvent: (handler) => {
    const listener = (_, event) => handler(event);
    ipcRenderer.on("task:event", listener);
    return () => ipcRenderer.removeListener("task:event", listener);
  },
  checkForUpdates: () => ipcRenderer.invoke("update:check"),
  downloadUpdate: () => ipcRenderer.invoke("update:download"),
  installUpdate: () => ipcRenderer.invoke("update:install"),
  onUpdateEvent: (handler) => {
    const listener = (_, event) => handler(event);
    ipcRenderer.on("update:event", listener);
    return () => ipcRenderer.removeListener("update:event", listener);
  }
};

contextBridge.exposeInMainWorld("excelTools", api);
