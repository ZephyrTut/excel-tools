const { contextBridge, ipcRenderer } = require("electron");

const api = {
  selectInputFile: () => ipcRenderer.invoke("dialog:select-input-file"),
  selectTemplateFile: () => ipcRenderer.invoke("dialog:select-template-file"),
  selectOutputDir: () => ipcRenderer.invoke("dialog:select-output-dir"),
  loadRules: () => ipcRenderer.invoke("rules:load"),
  getDefaultRules: () => ipcRenderer.invoke("rules:get-defaults"),
  saveRules: (rules) => ipcRenderer.invoke("rules:save", rules),
  startSplitTask: (payload) => ipcRenderer.invoke("task:start-split", payload),
  cancelTask: (taskId) => ipcRenderer.invoke("task:cancel", taskId),
  onTaskEvent: (handler) => {
    const listener = (_, event) => handler(event);
    ipcRenderer.on("task:event", listener);
    return () => ipcRenderer.removeListener("task:event", listener);
  }
};

contextBridge.exposeInMainWorld("excelTools", api);
