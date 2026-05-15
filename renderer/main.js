const sourceFileEl = document.getElementById('sourceFile');
const outputDirEl = document.getElementById('outputDir');
const logsEl = document.getElementById('logs');
const fileMetaEl = document.getElementById('fileMeta');

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function appendLog(message) {
  const line = document.createElement('div');
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logsEl.appendChild(line);
  logsEl.scrollTop = logsEl.scrollHeight;
}

function resolveErrorTip(error) {
  const errorCode = error?.code;
  const tips = {
    SHEET_MISSING: '规则中配置的 sheet 不存在。请检查 sheet 名称，或将策略改为 warnAndContinue。',
    COLUMN_INVALID: '拆分列配置无效。请在规则中使用 A、B、C 这类列名。',
    FILE_LOCKED: '输出文件被其他程序占用。请关闭占用文件后重试。',
    PERMISSION_DENIED: '当前账号没有文件读写权限。请更换目录或调整权限后重试。'
  };
  return tips[errorCode] || '请查看日志定位问题并重试。';
}

document.getElementById('pickFileBtn').addEventListener('click', async () => {
  const file = await window.excelToolsApi.selectFile();
  if (file) {
    sourceFileEl.value = file.path;
    fileMetaEl.textContent = `文件名: ${file.name} | 大小: ${formatBytes(file.size)}`;
  }
});

document.getElementById('pickDirBtn').addEventListener('click', async () => {
  const dir = await window.excelToolsApi.selectOutputDir();
  if (dir) outputDirEl.value = dir;
});

document.getElementById('runBtn').addEventListener('click', async () => {
  if (!sourceFileEl.value || !outputDirEl.value) {
    appendLog('请先选择源文件和输出目录');
    return;
  }
  appendLog('开始执行拆分任务');
  const result = await window.excelToolsApi.runSplit({
    sourceFile: sourceFileEl.value,
    outputDir: outputDirEl.value
  });
  appendLog(`任务结束：${result.success ? '成功' : '失败'}，输出 ${result.fileCount || 0} 个文件`);
  if (result.error) {
    const err = typeof result.error === 'string' ? { code: 'UNKNOWN_ERROR', message: result.error } : result.error;
    appendLog(`错误[${err.code || 'UNKNOWN_ERROR'}]：${err.message || '未知错误'}`);
    appendLog(`建议：${resolveErrorTip(err)}`);
  }
});

window.excelToolsApi.onSplitLog((msg) => appendLog(msg));
