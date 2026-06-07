const { contextBridge, ipcRenderer } = require("electron");

function sanitizeForIpc(value) {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeSendRule(rule) {
  if (!rule) return null;
  const safeRule = sanitizeForIpc(rule) || {};
  return {
    originalName: safeRule.originalName || "",
    mappedName: safeRule.mappedName || "",
    channels: Array.isArray(safeRule.channels)
      ? safeRule.channels.map((item) => String(item))
      : [],
    wechatGroup: safeRule.wechatGroup || null,
    emailSubject: safeRule.emailSubject || null,
    emailTo: Array.isArray(safeRule.emailTo)
      ? safeRule.emailTo.map((item) => String(item))
      : [],
    emailCc: Array.isArray(safeRule.emailCc)
      ? safeRule.emailCc.map((item) => String(item))
      : [],
  };
}

function normalizeSendPayload(payload) {
  const safePayload = sanitizeForIpc(payload) || {};
  const matched = Array.isArray(safePayload.matched) ? safePayload.matched : [];

  return {
    matched: matched.map((item) => {
      const safeItem = sanitizeForIpc(item) || {};
      return {
        originalName: safeItem.originalName || "",
        mappedName: safeItem.mappedName || "",
        resolvedSubject: safeItem.resolvedSubject || "",
        channels: Array.isArray(safeItem.channels)
          ? safeItem.channels.map((channel) => String(channel))
          : [],
        filePath: safeItem.filePath || "",
        rule: normalizeSendRule(safeItem.rule),
      };
    }),
    wechatFirst: safePayload.wechatFirst !== false,
  };
}

const api = {
  selectInputFile: () => ipcRenderer.invoke("dialog:select-input-file"),
  selectTemplateFile: () => ipcRenderer.invoke("dialog:select-template-file"),
  selectOutputDir: () => ipcRenderer.invoke("dialog:select-output-dir"),
  selectOptimizeFile: () => ipcRenderer.invoke("dialog:select-optimize-file"),
  getFileInfo: (filePath) => ipcRenderer.invoke("file:get-info", filePath),
  getSheetNames: (filePath) =>
    ipcRenderer.invoke("file:get-sheet-names", filePath),
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
  cancelTask: (taskId) =>
    ipcRenderer.invoke("task:cancel", sanitizeForIpc(taskId)),
  listTemplates: (scope) => ipcRenderer.invoke("template:list", scope),
  importTemplate: (scope, sourcePath) =>
    ipcRenderer.invoke("template:import", scope, sourcePath),
  deleteTemplate: (scope, name) =>
    ipcRenderer.invoke("template:delete", scope, name),
  runOptimize: (filePath) => ipcRenderer.invoke("optimize:run", filePath),
  saveOptimizedFile: (tempPath) =>
    ipcRenderer.invoke("optimize:save", tempPath),
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
  importSendRules: (filePath) =>
    ipcRenderer.invoke("send:import-rules", filePath),
  getSendRules: () => ipcRenderer.invoke("send:get-rules"),
  matchSendFiles: (folderPath) =>
    ipcRenderer.invoke("send:match-files", folderPath),
  sendItems: (payload) =>
    ipcRenderer.invoke("send:send", normalizeSendPayload(payload)),
  getSendHistory: () => ipcRenderer.invoke("send:get-history"),
  clearSendHistory: () => ipcRenderer.invoke("send:clear-history"),
  getSmtpConfig: () => ipcRenderer.invoke("send:get-smtp-config"),
  saveSmtpConfig: (config) =>
    ipcRenderer.invoke("send:save-smtp-config", sanitizeForIpc(config)),
  selectSendFolder: () => ipcRenderer.invoke("dialog:select-send-folder"),
  listFolderFiles: (folderPath) =>
    ipcRenderer.invoke("send:list-folder-files", folderPath),
  exportSendResults: (data) =>
    ipcRenderer.invoke("send:export-results", sanitizeForIpc(data)),
};

contextBridge.exposeInMainWorld("excelTools", api);
