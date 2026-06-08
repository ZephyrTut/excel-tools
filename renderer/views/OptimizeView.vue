<template>
  <div class="ov">
    <!-- Header -->
    <div class="ov-header animate-fade-in-up">
      <div class="ov-header-accent"></div>
      <h2 class="ov-title">XLSX 文件压缩</h2>
      <p class="ov-desc">拖拽文件或文件夹，ZIP 级别深度压缩（输出 _min.xlsx）</p>
    </div>

    <!-- Input: Drop zone (file + folder) -->
    <section class="ov-section animate-fade-in-up">
      <div class="section-label">选择输入</div>
      <div class="drop-zone ov-dropzone"
        :class="{ 'drop-zone--active': sourceDrop.isDragOver, 'ov-dropzone--has-input': !!state.inputPath }"
        @dragover.prevent="sourceDrop.onDragOver"
        @dragenter="sourceDrop.onDragEnter"
        @dragleave="sourceDrop.onDragLeave"
        @drop="onDrop"
      >
        <div class="ov-dropzone-inner">
          <div v-if="!state.inputPath" class="ov-dropzone-empty">
            <span class="ov-dropzone-icon">📂</span>
            <span class="ov-dropzone-text">拖拽 <strong>.xlsx</strong> 文件或<strong>文件夹</strong>到此处</span>
            <span class="ov-dropzone-or">或</span>
            <div class="ov-dropzone-actions">
              <el-button type="primary" plain @click="pickFile">选择文件</el-button>
              <el-button plain @click="pickDir">选择文件夹</el-button>
            </div>
          </div>
          <div v-else class="ov-dropzone-filled">
            <span class="ov-file-icon">{{ state.mode === 'dir' ? '📁' : '📊' }}</span>
            <div class="ov-file-info">
              <span class="ov-file-name">{{ state.mode === 'dir' ? state.inputPath : state.fileName }}</span>
              <span class="ov-file-size" v-if="state.fileList.length">
                {{ state.fileList.length }} 个 .xlsx 文件
              </span>
              <span class="ov-file-size" v-else-if="state.fileSize">
                {{ formatSize(state.fileSize) }}
              </span>
            </div>
            <el-button text type="primary" size="small" @click="resetInput">更换</el-button>
          </div>
        </div>
      </div>

      <!-- File list preview (folder mode) -->
      <div v-if="state.mode === 'dir' && state.fileList.length > 0 && !state.running && !state.result" class="ov-file-preview">
        <div class="ov-file-preview-header">
          <span>找到 {{ state.fileList.length }} 个文件</span>
          <el-button text size="small" @click="scanDir">重新扫描</el-button>
        </div>
        <div class="ov-file-preview-list">
          <div v-for="(f, i) in state.fileList.slice(0, 20)" :key="i" class="ov-file-preview-item">
            <span class="ov-fpi-name">{{ f.relative }}</span>
            <span class="ov-fpi-size">{{ formatSize(f.size) }}</span>
          </div>
          <div v-if="state.fileList.length > 20" class="ov-file-preview-more">
            ...还有 {{ state.fileList.length - 20 }} 个文件
          </div>
        </div>
      </div>
    </section>

    <!-- Action -->
    <section class="ov-section animate-fade-in-up">
      <div class="section-label">执行压缩</div>
      <div class="ov-action-card">
        <div class="ov-action-row">
          <el-button type="primary" size="large"
            :disabled="!state.inputPath || !state.hasFiles || state.running"
            :loading="state.running"
            class="ov-start-btn"
            @click="runCompress"
          >
            {{ state.running ? '压缩中...' : '开始压缩' }}
          </el-button>
          <div v-if="state.running" class="ov-progress-wrap">
            <el-progress :percentage="state.progress" :stroke-width="8" class="ov-progress" />
            <span class="ov-progress-label">{{ state.progress }}%</span>
          </div>
        </div>
        <div v-if="state.running && state.currentFile" class="ov-current-file">
          当前文件：{{ state.currentFile }}
        </div>
      </div>
    </section>

    <!-- Logs -->
    <section class="ov-section animate-fade-in-up">
      <LogPanel :lines="state.logs" @clear="state.logs = []" />
    </section>

    <!-- Results -->
    <section v-if="state.result" class="ov-section ov-result-section animate-slide-up">
      <div class="section-label">压缩结果</div>
      <div class="ov-result-summary">
        <div class="stat-card">
          <div class="stat-label">处理文件</div>
          <div class="stat-value">{{ state.result.totalFiles }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">原始大小</div>
          <div class="stat-value">{{ formatSize(state.result.totalOriginalSize) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">压缩后</div>
          <div class="stat-value primary">{{ formatSize(state.result.totalOptimizedSize) }}</div>
        </div>
        <div class="stat-card stat-card--savings">
          <div class="stat-label">压缩率</div>
          <div class="stat-value success">{{ state.result.savingsPercent }}%</div>
          <div class="stat-savings-bar-wrap">
            <div class="stat-savings-bar">
              <div class="stat-savings-fill" :style="{ width: Math.min(state.result.savingsPercent, 100) + '%' }"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="ov-result-table-wrap">
        <el-table :data="state.result.fileResults" stripe size="small" style="width:100%">
          <el-table-column label="文件名" prop="fileName" min-width="200" />
          <el-table-column label="原始" align="right" width="120">
            <template #default="{ row }">{{ formatSize(row.originalSize) }}</template>
          </el-table-column>
          <el-table-column label="压缩后" align="right" width="120">
            <template #default="{ row }"><span class="text-success">{{ formatSize(row.optimizedSize) }}</span></template>
          </el-table-column>
          <el-table-column label="压缩率" align="right" width="100">
            <template #default="{ row }">{{ row.savingsPercent }}%</template>
          </el-table-column>
        </el-table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, computed } from "vue";
import { ElMessage } from "element-plus";
import LogPanel from "../components/LogPanel.vue";
import { useDropZone } from "../composables/useDropZone";

const sourceDrop = reactive(useDropZone());

const state = reactive({
  mode: "",        // "file" | "dir"
  inputPath: "",
  fileName: "",
  fileSize: 0,
  fileList: [],
  running: false,
  progress: 0,
  currentFile: "",
  result: null,
  logs: [],
});

const hasFiles = computed(() => {
  if (state.mode === "dir") return state.fileList.length > 0;
  return !!state.inputPath;
});

function getApi() {
  const api = window.excelTools;
  if (!api) throw new Error("桌面桥接未就绪");
  return api;
}

function pushLog(line) {
  state.logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
  if (state.logs.length > 500) state.logs.splice(0, state.logs.length - 500);
}

function resetInput() {
  state.mode = "";
  state.inputPath = "";
  state.fileName = "";
  state.fileSize = 0;
  state.fileList = [];
  state.result = null;
  state.logs = [];
}

async function pickFile() {
  try {
    const info = await getApi().pickCompressFile();
    if (info) applyFile(info);
  } catch (err) { ElMessage.error(err.message); }
}

async function pickDir() {
  try {
    const info = await getApi().pickCompressDir();
    if (info) applyDir(info);
  } catch (err) { ElMessage.error(err.message); }
}

async function onDrop(e) {
  const droppedPath = sourceDrop.onDrop(e);
  if (!droppedPath) return;

  const info = await getApi().statCompressPath(droppedPath);
  if (!info) {
    ElMessage.warning("无法识别的路径");
    return;
  }
  if (info.type === "file") {
    if (!/\.xlsx$/i.test(info.name)) {
      ElMessage.warning("请选择 .xlsx 格式的文件");
      return;
    }
    applyFile(info);
  } else {
    applyDir(info);
  }
}

function applyFile(info) {
  resetInput();
  state.mode = "file";
  state.inputPath = info.path;
  state.fileName = info.name;
  state.fileSize = info.size;
}

async function applyDir(info) {
  resetInput();
  state.mode = "dir";
  state.inputPath = info.path;
  await scanDir();
}

async function scanDir() {
  try {
    const files = await getApi().listDirXlsx(state.inputPath);
    state.fileList = files;
  } catch { /* fallback */ }
}

async function runCompress() {
  if (!state.inputPath || !hasFiles.value) return;
  state.running = true;
  state.progress = 0;
  state.currentFile = "";
  state.result = null;
  state.logs = [];

  try {
    const payload = state.mode === "dir"
      ? { inputDir: state.inputPath }
      : { inputPath: state.inputPath };
    await getApi().runCompress(payload);
  } catch (err) {
    state.running = false;
    ElMessage.error(`启动压缩失败：${err.message}`);
  }
}

function handleTaskEvent(event) {
  if (event.type === "log" && event.level && event.message) {
    pushLog(`${event.level.toUpperCase()} ${event.message}`);
  } else if (event.type === "progress" && event.stage) {
    state.progress = event.progress;
    state.currentFile = event.stage;
  } else if (event.type === "done" && event.result) {
    state.running = false;
    state.progress = 100;
    state.currentFile = "";
    state.result = event.result;
    pushLog(`压缩完成：${event.result.totalFiles} 个文件`);
    ElMessage.success(`压缩完成！共处理 ${event.result.totalFiles} 个文件，压缩率 ${event.result.savingsPercent}%`);
  } else if (event.type === "error") {
    state.running = false;
    pushLog(`失败：${event.message}`);
    ElMessage.error(event.message);
  }
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0) + " " + units[i];
}

let unsubTask = null;
onMounted(() => {
  unsubTask = getApi().onTaskEvent(handleTaskEvent);
});
onUnmounted(() => {
  if (unsubTask) unsubTask();
});
</script>

<style scoped>
/* ── 页面结构 ── */
.ov {
  max-width: 800px;
  margin: 0 auto;
}

/* ── 页面标题 ── */
.ov-header {
  text-align: center;
  margin-bottom: 32px;
  padding: 16px 0 8px;
}
.ov-header-accent {
  width: 40px;
  height: 3px;
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
  border-radius: 2px;
  margin: 0 auto 16px;
}
.ov-title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 6px;
}
.ov-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
}

/* ── Section 通用 ── */
.ov-section {
  margin-bottom: 20px;
}
.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 10px;
  padding-left: 2px;
}

/* ── Drop Zone ── */
.ov-dropzone {
  transition: all 0.25s ease;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-surface);
  border-radius: var(--radius-sm);
  padding: 20px;
}
.ov-dropzone--has-input {
  min-height: 80px;
  padding: 16px 20px;
}
.ov-dropzone-inner {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ov-dropzone-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.ov-dropzone-icon {
  font-size: 40px;
  line-height: 1;
  margin-bottom: 4px;
}
.ov-dropzone-text {
  font-size: 14px;
  color: var(--text-secondary);
}
.ov-dropzone-or {
  font-size: 12px;
  color: var(--text-muted);
}
.ov-dropzone-actions {
  display: flex;
  gap: 8px;
}
.ov-dropzone-filled {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}
.ov-file-icon {
  font-size: 28px;
  line-height: 1;
}
.ov-file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ov-file-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}
.ov-file-size {
  font-size: 12px;
  color: var(--text-muted);
}

/* ── File list preview ── */
.ov-file-preview {
  margin-top: 12px;
  background: var(--bg-card);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-light);
  overflow: hidden;
}
.ov-file-preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-surface);
}
.ov-file-preview-list {
  max-height: 240px;
  overflow-y: auto;
}
.ov-file-preview-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 14px;
  font-size: 13px;
}
.ov-file-preview-item:nth-child(odd) {
  background: var(--bg-surface);
}
.ov-fpi-name {
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}
.ov-fpi-size {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.ov-file-preview-more {
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
  border-top: 1px solid var(--border-light);
}

/* ── 执行区卡片 ── */
.ov-action-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 24px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}
.ov-action-row {
  display: flex;
  align-items: center;
  gap: 20px;
}
.ov-start-btn {
  min-width: 148px;
  font-weight: 600;
}
.ov-progress-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}
.ov-progress {
  flex: 1;
  min-width: 120px;
}
.ov-progress-label {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 36px;
}
.ov-current-file {
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 结果区 ── */
.ov-result-section {
  margin-bottom: 32px;
}
.ov-result-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}
.ov-result-summary .stat-card {
  flex: 1;
  text-align: center;
  padding: 20px 16px;
}
.stat-card--savings .stat-value {
  font-size: 32px;
}
.stat-savings-bar-wrap {
  margin-top: 8px;
  padding: 0 12px;
}
.stat-savings-bar {
  height: 4px;
  background: var(--border-light);
  border-radius: 2px;
  overflow: hidden;
}
.stat-savings-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--success), #34d399);
  border-radius: 2px;
  transition: width 0.8s ease;
}
.ov-result-table-wrap {
  margin-bottom: 20px;
}

/* ── 响应式 ── */
@media (max-width: 640px) {
  .ov-result-summary {
    flex-direction: column;
  }
  .ov-action-row {
    flex-direction: column;
    align-items: stretch;
  }
  .ov-start-btn {
    width: 100%;
  }
}
</style>
