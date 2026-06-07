<template>
  <div class="ov">
    <!-- 页面标题 -->
    <div class="ov-header animate-fade-in-up">
      <div class="ov-header-accent"></div>
      <h2 class="ov-title">XLSX 文件压缩</h2>
      <p class="ov-desc">ZIP 级别深度压缩，清理空单元格、冗余 XML 与隐藏元数据</p>
    </div>

    <!-- §1 文件输入区 -->
    <section class="ov-section animate-fade-in-up">
      <div class="section-label">文件输入</div>
      <div
        class="drop-zone ov-dropzone"
        :class="{ 'drop-zone--active': sourceDrop.isDragOver, 'ov-dropzone--has-file': !!state.fileInfo.path }"
        @dragover.prevent="sourceDrop.onDragOver"
        @dragenter="sourceDrop.onDragEnter"
        @dragleave="sourceDrop.onDragLeave"
        @drop="onSourceFileDrop"
      >
        <div class="ov-dropzone-inner">
          <div v-if="!state.fileInfo.path" class="ov-dropzone-empty">
            <span class="ov-dropzone-icon">📄</span>
            <span class="ov-dropzone-text">拖拽 <strong>.xlsx</strong> 文件到此处</span>
            <span class="ov-dropzone-or">或</span>
            <el-button type="primary" plain @click="pickFile">选择文件</el-button>
          </div>
          <div v-else class="ov-dropzone-filled">
            <span class="ov-file-icon">📊</span>
            <div class="ov-file-info">
              <span class="ov-file-name">{{ state.fileInfo.name }}</span>
              <span class="ov-file-size">{{ formatSize(state.fileInfo.size) }}</span>
            </div>
            <el-button text type="primary" size="small" @click="pickFile">更换文件</el-button>
          </div>
        </div>
      </div>
    </section>

    <!-- §2 执行区 -->
    <section class="ov-section animate-fade-in-up">
      <div class="section-label">执行压缩</div>
      <div class="ov-action-card">
        <div class="ov-action-row">
          <el-button
            type="primary"
            size="large"
            :disabled="!state.fileInfo.path || state.optimizing"
            :loading="state.optimizing"
            class="ov-start-btn"
            @click="runOptimize"
          >
            <template #icon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </template>
            {{ state.optimizing ? '压缩中...' : '开始压缩' }}
          </el-button>
          <div v-if="state.optimizing || state.result" class="ov-progress-wrap">
            <el-progress
              :percentage="state.progress"
              :stroke-width="8"
              :status="state.progress === 100 ? 'success' : undefined"
              class="ov-progress"
            />
            <span class="ov-progress-label">{{ state.progress }}%</span>
          </div>
        </div>

        <!-- 压缩预估对比条 (仅在选中文件后显示) -->
        <div v-if="state.fileInfo.path && !state.optimizing && !state.result" class="ov-preview">
          <div class="ov-preview-bar">
            <span class="ov-preview-bar-label">原始</span>
            <div class="ov-preview-track">
              <div class="ov-preview-fill ov-preview-fill--raw" :style="{ width: '100%' }"></div>
            </div>
            <span class="ov-preview-bar-value">{{ formatSize(state.fileInfo.size) }}</span>
          </div>
          <div class="ov-preview-bar">
            <span class="ov-preview-bar-label">压缩后</span>
            <div class="ov-preview-track">
              <div class="ov-preview-fill ov-preview-fill--opt" :style="{ width: '0%' }"></div>
            </div>
            <span class="ov-preview-bar-value ov-preview-bar-value--muted">等待压缩</span>
          </div>
        </div>
      </div>
    </section>

    <!-- §3 日志 -->
    <section class="ov-section animate-fade-in-up">
      <LogPanel :lines="state.logs" @clear="state.logs = []" />
    </section>

    <!-- §4 结果区 -->
    <section v-if="state.result" class="ov-section ov-result-section animate-slide-up">
      <div class="section-label">压缩结果</div>

      <!-- 统计卡片 -->
      <div class="ov-result-stats">
        <div class="stat-card">
          <div class="stat-label">原始大小</div>
          <div class="stat-value">{{ formatSize(state.result.originalSize) }}</div>
        </div>
        <div class="ov-result-arrow">→</div>
        <div class="stat-card">
          <div class="stat-label">压缩后大小</div>
          <div class="stat-value primary">{{ formatSize(state.result.optimizedSize) }}</div>
        </div>
        <div class="ov-result-arrow">→</div>
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

      <!-- Sheet 明细表 -->
      <div class="ov-result-table-wrap">
        <el-table :data="state.result.sheets" stripe size="small" class="ov-table" style="width: 100%">
          <el-table-column label="Sheet 名称" prop="name" min-width="180" />
          <el-table-column label="压缩前" align="right" width="140">
            <template #default="{ row }">
              {{ formatSize(row.originalSize) }}
            </template>
          </el-table-column>
          <el-table-column label="压缩后" align="right" width="140">
            <template #default="{ row }">
              <span class="text-success">{{ formatSize(row.optimizedSize) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="压缩率" align="right" width="120">
            <template #default="{ row }">
              <span class="ov-compress-pct">{{ row.originalSize > 0 ? ((1 - row.optimizedSize / row.originalSize) * 100).toFixed(1) + '%' : '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="" width="80">
            <template #default="{ row }">
              <div v-if="row.originalSize > 0" class="ov-minibar">
                <div class="ov-minibar-fill" :style="{ width: ((1 - row.optimizedSize / row.originalSize) * 100).toFixed(0) + '%' }"></div>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 保存 -->
      <div class="ov-save-row">
        <el-button type="success" size="large" class="ov-save-btn" @click="saveFile" :icon="Download">
          {{ state.savedPath ? '保存另一份' : '保存压缩后的文件' }}
        </el-button>
        <transition name="fade">
          <span v-if="state.savedPath" class="ov-saved-hint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; color: var(--success)">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            已保存：{{ state.savedPath }}
          </span>
        </transition>
      </div>
    </section>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive } from "vue";
import { ElMessage } from "element-plus";
import { Download } from "@element-plus/icons-vue";
import LogPanel from "../components/LogPanel.vue";
import { useDropZone } from "../composables/useDropZone";

const sourceDrop = reactive(useDropZone());

const state = reactive({
  fileInfo: { path: "", name: "", size: 0 },
  optimizing: false,
  progress: 0,
  result: null,
  savedPath: "",
  logs: [],
});

let unsubTask = null;
const MAX_LOG_LINES = 500;

function pushLog(line) {
  state.logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
  if (state.logs.length > MAX_LOG_LINES) {
    state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
  }
}

function getApi() {
  const api = window.excelTools;
  if (!api) {
    throw new Error("桌面桥接未就绪：window.excelTools 不存在。请通过 Electron 窗口运行。");
  }
  return api;
}

async function pickFile() {
  try {
    const info = await getApi().selectOptimizeFile();
    if (info) applyFile(info);
  } catch (err) {
    ElMessage.error(err.message);
  }
}

function applyFile(info) {
  state.fileInfo = info;
  state.result = null;
  state.savedPath = "";
  state.logs = [];
}

async function onSourceFileDrop(e) {
  const filePath = sourceDrop.onDrop(e);
  if (!filePath) return;
  if (!filePath.toLowerCase().endsWith('.xlsx')) {
    ElMessage.warning('请拖入 .xlsx 格式的文件');
    return;
  }
  try {
    const info = await getApi().getFileInfo(filePath);
    applyFile(info);
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function runOptimize() {
  if (!state.fileInfo.path) return;
  state.optimizing = true;
  state.progress = 0;
  state.result = null;
  state.savedPath = "";
  state.logs = [];
  try {
    const result = await getApi().runOptimize(state.fileInfo.path);
    state.progress = 100;
    state.result = result;
    ElMessage.success(`压缩完成！压缩率 ${result.savingsPercent}%`);
  } catch (err) {
    state.progress = 0;
    ElMessage.error(`压缩失败：${err.message}`);
  } finally {
    state.optimizing = false;
  }
}

async function saveFile() {
  if (!state.result?.tempPath) return;
  try {
    const savedPath = await getApi().saveOptimizedFile(state.result.tempPath);
    if (savedPath) {
      state.savedPath = savedPath;
      ElMessage.success(`文件已保存到：${savedPath}`);
    }
  } catch (err) {
    ElMessage.error(`保存失败：${err.message}`);
  }
}

function handleTaskEvent(event) {
  if (!state.optimizing) return;
  if (event.type === "log") {
    pushLog(`${event.level.toUpperCase()} ${event.message}`);
  } else if (event.type === "progress") {
    state.progress = event.progress;
    pushLog(`进度 ${event.progress}% - ${event.stage}`);
  } else if (event.type === "error") {
    pushLog(`失败：${event.message}`);
  }
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0) + " " + units[i];
}

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
.ov-dropzone--has-file {
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

/* ── 压缩预估对比条 ── */
.ov-preview {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.ov-preview-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.ov-preview-bar-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  width: 48px;
  flex-shrink: 0;
}
.ov-preview-track {
  flex: 1;
  height: 8px;
  background: var(--bg-surface);
  border-radius: 4px;
  overflow: hidden;
}
.ov-preview-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}
.ov-preview-fill--raw {
  background: linear-gradient(90deg, var(--text-muted), #94a3b8);
}
.ov-preview-fill--opt {
  background: linear-gradient(90deg, var(--primary), var(--primary-light));
}
.ov-preview-bar-value {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  width: 80px;
  text-align: right;
  flex-shrink: 0;
}
.ov-preview-bar-value--muted {
  color: var(--text-muted);
  font-weight: 400;
}

/* ── 结果区 ── */
.ov-result-section {
  margin-bottom: 32px;
}

/* 统计卡片行 */
.ov-result-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
}
.ov-result-stats .stat-card {
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
.ov-result-arrow {
  font-size: 18px;
  color: var(--text-muted);
  font-weight: 300;
  flex-shrink: 0;
}

/* 表格 */
.ov-result-table-wrap {
  margin-bottom: 20px;
}
.ov-table :deep(.el-table__header th) {
  background: var(--bg-surface);
  font-weight: 600;
  font-size: 12px;
  color: var(--text-secondary);
}
.ov-compress-pct {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--success);
}
.ov-minibar {
  width: 60px;
  height: 6px;
  background: var(--border-light);
  border-radius: 3px;
  overflow: hidden;
  margin: 0 auto;
}
.ov-minibar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--success), #34d399);
  border-radius: 3px;
  transition: width 0.5s ease;
}

/* 保存行 */
.ov-save-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.ov-save-btn {
  min-width: 180px;
  font-weight: 600;
}
.ov-saved-hint {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  color: var(--success);
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 淡入过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── 响应式 ── */
@media (max-width: 640px) {
  .ov-result-stats {
    flex-direction: column;
  }
  .ov-result-arrow {
    transform: rotate(90deg);
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
