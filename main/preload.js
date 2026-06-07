const { contextBridge, ipcRenderer } = require("electron");

function sanitizeForIpc(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

const api = {
  selectInputFile: () => ipcRenderer.invoke("dialog:select-input-file"),
  selectTemplateFile: () => ipcRenderer.invoke("dialog:select-template-file"),
  selectOutputDir: () => ipcRenderer.invoke("dialog:select-output-dir"),
  selectOptimizeFile: () => ipcRenderer.invoke("dialog:select-optimize-file"),
  getFileInfo: (filePath) => ipcRenderer.invoke("file:get-info", filePath),
  getSheetNames: (filePath) => ipcRenderer.invoke("file:get-sheet-names", filePath),
  getDirectorySheetNames: (inputDir, excludedPaths = []) =>
    ipcRenderer.invoke(
      "file:get-directory-sheet-names",
      sanitizeForIpc(inputDir),
      sanitizeForIpc(excludedPaths)
    ),
  preloadMergeHeaders: (payload) =>
    ipcRenderer.invoke("merge:preload-headers", sanitizeForIpc(payload)),
  loadRules: () => ipcRenderer.invoke("rules:load"),
  getDefaultRules: () => ipcRenderer.invoke("rules:get-defaults"),
  saveRules: (rules) => ipcRenderer.invoke("rules:save", sanitizeForIpc(rules)),
  startSplitTask: (payload) =>
    ipcRenderer.invoke("task:start-split", sanitizeForIpc(payload)),
  startMergeTask: (payload) =>
    ipcRenderer.invoke("task:start-merge", sanitizeForIpc(payload)),
  cancelTask: (taskId) => ipcRenderer.invoke("task:cancel", sanitizeForIpc(taskId)),
  listTemplates: (scope) => ipcRenderer.invoke("template:list", scope),
  importTemplate: (scope, sourcePath) => ipcRenderer.invoke("template:import", scope, sourcePath),
  deleteTemplate: (scope, name) => ipcRenderer.invoke("template:delete", scope, name),
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
  },

  // ── 发送工具 ──────────────────────────────────────────────────
  importSendRules: (filePath) => ipcRenderer.invoke("send:import-rules", filePath),
  getSendRules: () => ipcRenderer.invoke("send:get-rules"),
  matchSendFiles: (folderPath) => ipcRenderer.invoke("send:match-files", folderPath),
  sendItems: (payload) => ipcRenderer.invoke("send:send", sanitizeForIpc(payload)),
  getSendHistory: () => ipcRenderer.invoke("send:get-history"),
  getSmtpConfig: () => ipcRenderer.invoke("send:get-smtp-config"),
  saveSmtpConfig: (config) => ipcRenderer.invoke("send:save-smtp-config", sanitizeForIpc(config)),
  selectSendFolder: () => ipcRenderer.invoke("dialog:select-send-folder"),
};

contextBridge.exposeInMainWorld("excelTools", api);
