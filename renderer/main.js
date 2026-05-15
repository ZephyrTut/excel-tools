const sourceFileEl = document.getElementById('sourceFile');
const outputDirEl = document.getElementById('outputDir');
const logsEl = document.getElementById('logs');
const fileMetaEl = document.getElementById('fileMeta');
const runStatusEl = document.getElementById('runStatus');
const summaryEl = document.getElementById('summary');
const rulesEditorEl = document.getElementById('rulesEditor');

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

function renderSummary(summary) {
  if (!summary) {
    summaryEl.textContent = '执行后摘要：暂无';
    return;
  }
  const failed = (summary.failedItems || []).join('；') || '无';
  summaryEl.textContent = `执行后摘要：总键数 ${summary.totalKeys || 0} / 输出文件数 ${summary.outputFileCount || 0} / 失败项 ${failed}`;
}

async function loadRules() {
  const rules = await window.excelToolsApi.getRules();
  rulesEditorEl.value = JSON.stringify(rules, null, 2);
}

document.getElementById('loadRulesBtn').addEventListener('click', loadRules);

document.getElementById('saveRulesBtn').addEventListener('click', async () => {
  try {
    const parsed = JSON.parse(rulesEditorEl.value);
    const result = await window.excelToolsApi.saveRules(parsed);
    if (!result.success) return appendLog(`保存失败：${result.errors.join('；')}`);
    appendLog('规则保存成功');
  } catch (error) {
    appendLog(`规则 JSON 解析失败：${error.message}`);
  }
});

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
  runStatusEl.textContent = '执行状态：执行前校验中';
  const preflight = await window.excelToolsApi.preflightSplit({
    sourceFile: sourceFileEl.value,
    outputDir: outputDirEl.value
  });
  if (!preflight.success) {
    runStatusEl.textContent = '执行状态：校验失败';
    appendLog(`校验失败：${preflight.errors.join('；')}`);
    return;
  }

  runStatusEl.textContent = '执行状态：执行中';
  appendLog('开始执行拆分任务');
  const result = await window.excelToolsApi.runSplit({
    sourceFile: sourceFileEl.value,
    outputDir: outputDirEl.value
  });
  runStatusEl.textContent = `执行状态：${result.success ? '执行完成' : '执行失败'}`;
  renderSummary(result.summary);
  appendLog(`任务结束：${result.success ? '成功' : '失败'}，输出 ${result.fileCount || 0} 个文件`);
  if (result.error) appendLog(`错误：${result.error}`);
});

window.excelToolsApi.onSplitLog((msg) => appendLog(msg));

(async function init() {
  await loadRules();
  const report = await window.excelToolsApi.getLastTaskReport();
  if (report?.summary) {
    runStatusEl.textContent = `执行状态：最近一次执行于 ${new Date(report.runAt).toLocaleString()}`;
    renderSummary(report.summary);
  }
})();
