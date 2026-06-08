<template>
  <div class="compress-page">
    <header class="compress-hero">
      <div>
        <p class="eyebrow">Office 兼容压缩</p>
        <h2>XLSX 文件压缩</h2>
        <p class="hero-copy">
          压缩会清理冗余 XML 与空样式，同时保留公式、数据验证、条件格式等 Office 关键结构。
        </p>
      </div>
      <div class="hero-meter" v-if="state.result">
        <span>本次节省</span>
        <strong>{{ state.result.savingsPercent }}%</strong>
      </div>
    </header>

    <section class="compress-panel">
      <div class="panel-title">
        <span>输入文件</span>
        <el-button v-if="state.inputPath" text type="primary" @click="resetInput">重新选择</el-button>
      </div>

      <div
        class="drop-zone compress-dropzone"
        :class="{ 'drop-zone--active': sourceDrop.isDragOver, 'has-input': !!state.inputPath }"
        @dragover.prevent="sourceDrop.onDragOver"
        @dragenter="sourceDrop.onDragEnter"
        @dragleave="sourceDrop.onDragLeave"
        @drop="onDrop"
      >
        <div v-if="!state.inputPath" class="drop-empty">
          <span class="drop-empty-icon">📂</span>
          <div class="drop-text">
            <strong>拖拽 .xlsx 文件或文件夹到这里</strong>
            <span>单文件会输出同目录 `_min.xlsx`，文件夹会批量处理全部 Excel 文件。</span>
          </div>
          <div class="drop-actions">
            <el-button type="primary" @click="pickFile">选择文件</el-button>
            <el-button @click="pickDir">选择文件夹</el-button>
          </div>
        </div>

        <div v-else class="drop-filled">
          <span class="file-kind-icon">{{ state.mode === "dir" ? "📁" : "📊" }}</span>
          <div class="file-meta">
            <strong>{{ state.mode === "dir" ? state.inputPath : state.fileName }}</strong>
            <span v-if="state.mode === 'dir'">{{ state.fileList.length }} 个 .xlsx 文件</span>
            <span v-else>{{ formatSize(state.fileSize) }}</span>
          </div>
        </div>
      </div>

      <div v-if="state.mode === 'dir' && state.fileList.length > 0 && !state.result" class="file-preview">
        <div class="file-preview-head">
          <span>已扫描到 {{ state.fileList.length }} 个文件</span>
          <el-button text size="small" @click="scanDir">重新扫描</el-button>
        </div>
        <div class="file-preview-list">
          <div v-for="(file, index) in state.fileList.slice(0, 20)" :key="index" class="file-preview-row">
            <span>{{ file.relative }}</span>
            <em>{{ formatSize(file.size) }}</em>
          </div>
          <div v-if="state.fileList.length > 20" class="file-preview-more">
            还有 {{ state.fileList.length - 20 }} 个文件未显示
          </div>
        </div>
      </div>
    </section>

    <section class="compress-panel action-panel">
      <div class="run-row">
        <el-button
          type="primary"
          size="large"
          :disabled="!state.inputPath || !hasFiles || state.running"
          :loading="state.running"
          class="run-button"
          @click="runCompress"
        >
          {{ state.running ? "压缩中..." : "开始压缩" }}
        </el-button>
        <div v-if="state.running" class="progress-area">
          <el-progress :percentage="state.progress" :stroke-width="9" />
          <span>{{ state.progress }}%</span>
        </div>
      </div>
      <p v-if="state.running && state.currentFile" class="current-file">{{ state.currentFile }}</p>
    </section>

    <section class="compress-panel">
      <LogPanel :lines="state.logs" @clear="state.logs = []" />
    </section>

    <section v-if="state.result" class="result-shell">
      <div class="result-head">
        <div>
          <p class="eyebrow">压缩结果</p>
          <h3>已完成 {{ state.result.totalFiles }} 个文件</h3>
        </div>
        <el-button v-if="firstOutputPath" type="primary" plain @click="openFile(firstOutputPath)">
          打开压缩文件
        </el-button>
      </div>

      <div class="result-stats">
        <div class="result-stat">
          <span>原始大小</span>
          <strong>{{ formatSize(state.result.totalOriginalSize) }}</strong>
        </div>
        <div class="result-stat">
          <span>压缩后</span>
          <strong>{{ formatSize(state.result.totalOptimizedSize) }}</strong>
        </div>
        <div class="result-stat accent">
          <span>压缩率</span>
          <strong>{{ state.result.savingsPercent }}%</strong>
          <div class="saving-track">
            <div :style="{ width: savingsWidth }"></div>
          </div>
        </div>
      </div>

      <div class="result-table">
        <el-table :data="state.result.fileResults" size="small" style="width: 100%">
          <el-table-column prop="fileName" label="文件名" min-width="220" />
          <el-table-column label="原始" align="right" width="120">
            <template #default="{ row }">{{ formatSize(row.originalSize) }}</template>
          </el-table-column>
          <el-table-column label="压缩后" align="right" width="120">
            <template #default="{ row }">{{ formatSize(row.optimizedSize) }}</template>
          </el-table-column>
          <el-table-column label="压缩率" align="right" width="100">
            <template #default="{ row }">{{ row.savingsPercent }}%</template>
          </el-table-column>
          <el-table-column label="操作" align="right" width="120">
            <template #default="{ row }">
              <el-button text type="primary" :disabled="!row.outputPath" @click="openFile(row.outputPath)">
                打开
              </el-button>
            </template>
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
  mode: "",
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
  return Boolean(state.inputPath);
});

const firstOutputPath = computed(() => state.result?.fileResults?.find((item) => item.outputPath)?.outputPath || "");

const savingsWidth = computed(() => {
  const value = Number(state.result?.savingsPercent || 0);
  return `${Math.max(0, Math.min(value, 100))}%`;
});

function getApi() {
  const api = window.excelTools;
  if (!api) throw new Error("桌面桥接未就绪，请重启 Electron 窗口后重试。");
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
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function pickDir() {
  try {
    const info = await getApi().pickCompressDir();
    if (info) applyDir(info);
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function onDrop(event) {
  const droppedPath = sourceDrop.onDrop(event);
  if (!droppedPath) return;

  const info = await getApi().statCompressPath(droppedPath);
  if (!info) {
    ElMessage.warning("无法识别拖入路径。");
    return;
  }
  if (info.type === "file") {
    if (!/\.xlsx$/i.test(info.name)) {
      ElMessage.warning("请选择 .xlsx 格式的文件。");
      return;
    }
    applyFile(info);
    return;
  }
  applyDir(info);
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
    state.fileList = await getApi().listDirXlsx(state.inputPath);
  } catch (err) {
    state.fileList = [];
    ElMessage.warning(`扫描文件夹失败：${err.message}`);
  }
}

async function runCompress() {
  if (!state.inputPath || !hasFiles.value) return;
  state.running = true;
  state.progress = 0;
  state.currentFile = "";
  state.result = null;
  state.logs = [];

  try {
    const payload = state.mode === "dir" ? { inputDir: state.inputPath } : { inputPath: state.inputPath };
    await getApi().runCompress(payload);
  } catch (err) {
    state.running = false;
    ElMessage.error(`启动压缩失败：${err.message}`);
  }
}

async function openFile(filePath) {
  if (!filePath) return;
  try {
    const result = await getApi().openCompressFile(filePath);
    if (result && result.ok === false) {
      ElMessage.error(`打开失败：${result.message}`);
    }
  } catch (err) {
    ElMessage.error(`打开失败：${err.message}`);
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
    ElMessage.success(`压缩完成，共处理 ${event.result.totalFiles} 个文件。`);
  } else if (event.type === "error") {
    state.running = false;
    pushLog(`失败：${event.message}`);
    ElMessage.error(event.message);
  }
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index > 0 ? 2 : 0)} ${units[index]}`;
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
.compress-page {
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: 32px;
}

.compress-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 18px;
  padding: 20px 0 8px;
}

.eyebrow {
  margin: 0 0 6px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.compress-hero h2,
.result-head h3 {
  margin: 0;
  color: var(--text-primary);
  font-family: var(--font-display);
}

.compress-hero h2 {
  font-size: 28px;
}

.hero-copy {
  max-width: 620px;
  margin: 8px 0 0;
  color: var(--text-secondary);
  font-size: 14px;
}

.hero-meter {
  min-width: 148px;
  padding: 14px 18px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  text-align: right;
}

.hero-meter span,
.result-stat span {
  display: block;
  color: var(--text-muted);
  font-size: 12px;
}

.hero-meter strong {
  display: block;
  color: var(--success);
  font-family: var(--font-mono);
  font-size: 26px;
}

.compress-panel,
.result-shell {
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.panel-title,
.file-preview-head,
.result-head,
.run-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-title {
  margin-bottom: 12px;
  color: var(--text-primary);
  font-weight: 700;
}

.compress-dropzone {
  min-height: 156px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  border-radius: var(--radius-sm);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.76), rgba(248, 250, 252, 0.76)),
    repeating-linear-gradient(135deg, rgba(15, 23, 42, 0.04) 0 1px, transparent 1px 12px);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.compress-dropzone.drop-zone--active {
  transform: translateY(-1px);
  border-color: var(--primary);
}

.compress-dropzone.has-input {
  min-height: 90px;
}

.drop-empty,
.drop-filled {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16px;
}

.drop-empty {
  justify-content: center;
  flex-wrap: wrap;
}

.drop-empty-icon,
.file-kind-icon {
  flex: 0 0 auto;
  font-size: 42px;
  line-height: 1;
}

.file-kind-icon {
  font-size: 30px;
}

.drop-text,
.file-meta {
  flex: 1;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drop-text strong,
.file-meta strong {
  color: var(--text-primary);
  font-size: 15px;
}

.drop-text span,
.file-meta span,
.current-file {
  color: var(--text-muted);
  font-size: 13px;
}

.drop-actions {
  display: flex;
  gap: 8px;
}

.file-preview {
  margin-top: 14px;
  overflow: hidden;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
}

.file-preview-head {
  padding: 10px 12px;
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 700;
}

.file-preview-list {
  max-height: 230px;
  overflow-y: auto;
}

.file-preview-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  color: var(--text-primary);
  font-size: 13px;
}

.file-preview-row:nth-child(even) {
  background: var(--bg-surface);
}

.file-preview-row span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-preview-row em {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
  font-style: normal;
}

.file-preview-more {
  padding: 9px 12px;
  border-top: 1px solid var(--border-light);
  color: var(--text-muted);
  text-align: center;
  font-size: 12px;
}

.action-panel {
  padding: 16px 18px;
}

.run-button {
  min-width: 142px;
  font-weight: 700;
}

.progress-area {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(140px, 1fr) 46px;
  align-items: center;
  gap: 10px;
}

.progress-area span {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
}

.current-file {
  margin: 12px 0 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-shell {
  padding: 20px;
}

.result-head {
  margin-bottom: 16px;
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.result-stat {
  padding: 16px;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
}

.result-stat strong {
  display: block;
  margin-top: 6px;
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 20px;
}

.result-stat.accent strong {
  color: var(--success);
  font-size: 24px;
}

.saving-track {
  height: 5px;
  margin-top: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--border-light);
}

.saving-track div {
  height: 100%;
  border-radius: inherit;
  background: var(--success);
}

.result-table {
  overflow: hidden;
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
}

@media (max-width: 720px) {
  .compress-hero,
  .result-head,
  .run-row {
    align-items: stretch;
    flex-direction: column;
  }

  .hero-meter {
    text-align: left;
  }

  .result-stats {
    grid-template-columns: 1fr;
  }

  .drop-empty,
  .drop-filled {
    align-items: flex-start;
    flex-direction: column;
  }

  .drop-actions,
  .run-button {
    width: 100%;
  }
}
</style>
