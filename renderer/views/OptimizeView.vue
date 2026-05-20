<template>
  <div class="optimize-grid">
    <!-- 文件选择 -->
    <el-card class="panel-card">
      <template #header>
        <span>选择文件</span>
      </template>
      <el-form label-width="100px">
        <el-form-item label="源文件">
          <div style="display: flex; gap: 8px; width: 100%">
            <el-input v-model="state.fileInfo.name" placeholder="未选择文件" readonly>
              <template #append>
                <el-button @click="pickFile">选择</el-button>
              </template>
            </el-input>
          </div>
        </el-form-item>
        <el-form-item label="文件大小">
          <el-text>{{ state.fileInfo.size ? formatSize(state.fileInfo.size) : '-' }}</el-text>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 优化操作 -->
    <el-card class="panel-card">
      <template #header>
        <span>执行优化</span>
      </template>
      <el-space>
        <el-button
          type="primary"
          :disabled="!state.fileInfo.path || state.optimizing"
          :loading="state.optimizing"
          @click="runOptimize"
        >
          {{ state.optimizing ? '优化中...' : '开始优化' }}
        </el-button>
        <el-progress
          v-if="state.optimizing"
          :percentage="state.progress"
          :stroke-width="14"
          style="width: 240px"
          :status="state.progress === 100 ? 'success' : undefined"
        />
      </el-space>
    </el-card>

    <!-- 优化结果 -->
    <el-card v-if="state.result" class="panel-card">
      <template #header>
        <span>优化结果</span>
      </template>

      <div style="display: flex; gap: 24px; margin-bottom: 16px">
        <div class="stat-box">
          <div class="stat-label">原始大小</div>
          <div class="stat-value">{{ formatSize(state.result.originalSize) }}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">优化后大小</div>
          <div class="stat-value stat-primary">{{ formatSize(state.result.optimizedSize) }}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">压缩率</div>
          <div class="stat-value stat-success">{{ state.result.savingsPercent }}%</div>
        </div>
      </div>

      <el-table :data="state.result.sheets" border stripe size="small" style="width: 100%">
        <el-table-column label="Sheet" prop="name" />
        <el-table-column label="优化前" align="right">
          <template #default="{ row }">
            {{ formatSize(row.originalSize) }}
          </template>
        </el-table-column>
        <el-table-column label="优化后" align="right">
          <template #default="{ row }">
            <span class="text-success">{{ formatSize(row.optimizedSize) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="压缩率" align="right">
          <template #default="{ row }">
            {{ row.originalSize > 0 ? ((1 - row.optimizedSize / row.originalSize) * 100).toFixed(1) + '%' : '-' }}
          </template>
        </el-table-column>
      </el-table>

      <div style="margin-top: 16px">
        <el-button type="success" @click="saveFile">
          保存优化后的文件
        </el-button>
        <el-text v-if="state.savedPath" type="success" style="margin-left: 12px">
          已保存：{{ state.savedPath }}
        </el-text>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { ElMessage } from "element-plus";

const state = reactive({
  fileInfo: { path: "", name: "", size: 0 },
  optimizing: false,
  progress: 0,
  result: null,
  savedPath: "",
});

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
    if (info) {
      state.fileInfo = info;
      state.result = null;
      state.savedPath = "";
    }
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

  try {
    // Simulate progress animation (optimize runs in main process)
    const progressTimer = setInterval(() => {
      state.progress = Math.min(state.progress + 10, 90);
    }, 300);

    const result = await getApi().runOptimize(state.fileInfo.path);

    clearInterval(progressTimer);
    state.progress = 100;
    state.result = result;

    ElMessage.success(`优化完成！压缩率 ${result.savingsPercent}%`);
  } catch (err) {
    state.progress = 0;
    ElMessage.error(`优化失败：${err.message}`);
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

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0) + " " + units[i];
}
</script>

<style scoped>
.optimize-grid {
  display: grid;
  gap: 16px;
  max-width: 900px;
}
.panel-card :deep(.el-card__body) {
  padding: 16px 20px;
}
.stat-box {
  flex: 1;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}
.stat-label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}
.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}
.stat-primary {
  color: #409eff;
}
.stat-success {
  color: #67c23a;
}
.text-success {
  color: #67c23a;
  font-weight: 600;
}
</style>
