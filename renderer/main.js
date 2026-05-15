const sourceFileEl = document.getElementById('sourceFile');
const outputDirEl = document.getElementById('outputDir');
const logsEl = document.getElementById('logs');
const fileMetaEl = document.getElementById('fileMeta');
const fileNameTemplateEl = document.getElementById('fileNameTemplate');
const conflictPolicyEl = document.getElementById('conflictPolicy');
const namingExampleEl = document.getElementById('namingExample');

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

function updateNamingExample() {
  const template = fileNameTemplateEl.value || '{key}';
  const policy = conflictPolicyEl.value;
  const base = template
    .replace(/\{key\}/g, 'demo')
    .replace(/\{sheet\}/g, '日报')
    .replace(/\{date\}/g, '2026-01-01')
    .replace(/\{time\}/g, '08-00-00')
    .replace(/\{datetime\}/g, '2026-01-01-08-00-00');

  let preview = `${base}.xlsx`;
  if (policy === 'timestamp') preview = `${base}-2026-01-01-08-00-00.xlsx`;
  if (policy === 'increment') preview = `${base}-1.xlsx`;

  namingExampleEl.textContent = `示例文件名: ${preview}`;
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
    outputDir: outputDirEl.value,
    namingConfig: {
      fileNameTemplate: fileNameTemplateEl.value,
      conflictPolicy: conflictPolicyEl.value
    }
  });
  appendLog(`任务结束：${result.success ? '成功' : '失败'}，输出 ${result.fileCount || 0} 个文件`);
  if (result.error) appendLog(`错误：${result.error}`);
});

fileNameTemplateEl.addEventListener('input', updateNamingExample);
conflictPolicyEl.addEventListener('change', updateNamingExample);
updateNamingExample();

window.excelToolsApi.onSplitLog((msg) => appendLog(msg));
