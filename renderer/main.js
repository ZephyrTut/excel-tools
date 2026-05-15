const sourceFileEl = document.getElementById('sourceFile');
const outputDirEl = document.getElementById('outputDir');
const logsEl = document.getElementById('logs');
const fileMetaEl = document.getElementById('fileMeta');
const taskStatusEl = document.getElementById('taskStatus');
const taskProgressTextEl = document.getElementById('taskProgressText');
const taskProgressEl = document.getElementById('taskProgress');
const cancelBtn = document.getElementById('cancelBtn');

let currentTaskId = null;

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

function renderTaskStatus(task) {
  const stateMap = {
    pending: '待处理', running: '运行中', success: '成功', failed: '失败', canceled: '已取消'
  };
  taskStatusEl.textContent = `任务状态：${stateMap[task.status] || task.status}（${task.taskId}）`;
  const percent = Number(task.progress?.percent ?? 0);
  taskProgressEl.value = Math.min(100, Math.max(0, percent));
  taskProgressTextEl.textContent = `${task.progress?.message || '处理中...'} (${taskProgressEl.value}%)`;
  cancelBtn.disabled = task.status !== 'running';
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
  currentTaskId = result.taskId;
  appendLog(`任务结束：${result.success ? '成功' : '失败'}，输出 ${result.fileCount || 0} 个文件`);
  if (result.error) appendLog(`错误：${result.error}`);
});

cancelBtn.addEventListener('click', async () => {
  if (!currentTaskId) return;
  const result = await window.excelToolsApi.cancelSplit(currentTaskId);
  appendLog(result.success ? `任务已取消: ${currentTaskId}` : `取消失败: ${result.error}`);
});

window.excelToolsApi.onSplitLog((payload) => appendLog(`[${payload.taskId}] ${payload.message}`));
window.excelToolsApi.onTaskUpdate((task) => {
  if (!currentTaskId || currentTaskId === task.taskId || task.status === 'pending') {
    currentTaskId = task.taskId;
    renderTaskStatus(task);
  }
});
