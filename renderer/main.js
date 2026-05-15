const sourceFileEl = document.getElementById('sourceFile');
const outputDirEl = document.getElementById('outputDir');
const logsEl = document.getElementById('logs');
const fileMetaEl = document.getElementById('fileMeta');
const rulesPathEl = document.getElementById('rulesPath');

const ruleForm = {
  sheetName: document.getElementById('sheetName'),
  enabled: document.getElementById('enabled'),
  headerRows: document.getElementById('headerRows'),
  splitColumn: document.getElementById('splitColumn'),
  splitBy: document.getElementById('splitBy'),
  outputSheetName: document.getElementById('outputSheetName'),
  renameMap: document.getElementById('renameMap'),
  valueTransform: document.getElementById('valueTransform'),
  skipEmpty: document.getElementById('skipEmpty')
};

let currentRules = null;

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

function setRuleToForm(rule = {}) {
  ruleForm.sheetName.value = rule.sheetName || '';
  ruleForm.enabled.checked = rule.enabled !== false;
  ruleForm.headerRows.value = rule.headerRows ?? 1;
  ruleForm.splitColumn.value = rule.splitColumn || 'A';
  ruleForm.splitBy.value = rule.splitBy || 'column';
  ruleForm.outputSheetName.value = rule.outputSheetName || '';
  ruleForm.renameMap.value = JSON.stringify(rule.renameMap || {}, null, 2);
  ruleForm.valueTransform.value = JSON.stringify(rule.valueTransform || {}, null, 2);
  ruleForm.skipEmpty.checked = rule.skipEmpty === true;
}

function readRuleFromForm() {
  return {
    sheetName: ruleForm.sheetName.value.trim(),
    enabled: ruleForm.enabled.checked,
    headerRows: Number(ruleForm.headerRows.value || 1),
    splitColumn: ruleForm.splitColumn.value.trim(),
    splitBy: ruleForm.splitBy.value.trim(),
    outputSheetName: ruleForm.outputSheetName.value.trim(),
    renameMap: JSON.parse(ruleForm.renameMap.value || '{}'),
    valueTransform: JSON.parse(ruleForm.valueTransform.value || '{}'),
    skipEmpty: ruleForm.skipEmpty.checked
  };
}

async function loadRules(path) {
  const data = await window.excelToolsApi.getRules(path ? { path } : {});
  currentRules = data.rules;
  rulesPathEl.value = data.path;
  setRuleToForm(currentRules.sheetRules?.[0] || {});
  appendLog(`已加载规则: ${data.path}`);
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

document.getElementById('pickRulesBtn').addEventListener('click', async () => {
  const path = await window.excelToolsApi.selectRulesPath();
  if (path) await loadRules(path);
});

document.getElementById('loadRulesBtn').addEventListener('click', async () => {
  try {
    await loadRules(rulesPathEl.value || undefined);
  } catch (error) {
    appendLog(`加载失败: ${error.message}`);
  }
});

document.getElementById('saveRulesBtn').addEventListener('click', async () => {
  try {
    if (!currentRules) currentRules = { sheetRules: [] };
    const firstRule = readRuleFromForm();
    currentRules.sheetRules = [firstRule, ...(currentRules.sheetRules || []).slice(1)];
    const saved = await window.excelToolsApi.saveRules({ path: rulesPathEl.value || undefined, rules: currentRules });
    currentRules = saved.rules;
    rulesPathEl.value = saved.path;
    setRuleToForm(currentRules.sheetRules[0]);
    appendLog(`规则已保存: ${saved.path}`);
  } catch (error) {
    appendLog(`保存失败: ${error.message}`);
  }
});

document.getElementById('resetRulesBtn').addEventListener('click', async () => {
  try {
    const data = await window.excelToolsApi.resetDefaultRules();
    currentRules = data.rules;
    rulesPathEl.value = data.path;
    setRuleToForm(currentRules.sheetRules?.[0] || {});
    appendLog('已恢复默认规则');
  } catch (error) {
    appendLog(`恢复失败: ${error.message}`);
  }
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
    rulesPath: rulesPathEl.value || undefined
  });
  appendLog(`任务结束：${result.success ? '成功' : '失败'}，输出 ${result.fileCount || 0} 个文件`);
  if (result.error) appendLog(`错误：${result.error}`);
});

window.excelToolsApi.onSplitLog((msg) => appendLog(msg));
loadRules().catch((error) => appendLog(`初始化规则失败: ${error.message}`));
