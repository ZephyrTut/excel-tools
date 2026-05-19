<template>
  <div class="merge-grid">
    <el-card class="panel-card">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>合并汇总配置</span>
        </div>
      </template>
      <el-form label-width="120px">
        <el-form-item label="模板文件">
          <el-input v-model="state.templateFile" placeholder="选择模板 xlsx 文件" readonly>
            <template #append>
              <el-button @click="pickTemplate">选择</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="数据目录">
          <el-input v-model="state.inputDir" placeholder="选择包含子表的目录" readonly>
            <template #append>
              <el-button @click="pickInputDir">选择</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="输出目录">
          <el-input v-model="state.outputDir" placeholder="选择输出目录" readonly>
            <template #append>
              <el-button @click="pickOutputDir">选择</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="任务状态">
          <el-tag :type="statusType">{{ state.status }}</el-tag>
          <el-progress style="margin-left: 12px; width: 240px" :percentage="state.progress" :stroke-width="14" />
        </el-form-item>
        <el-form-item>
          <el-space wrap>
            <el-button
              type="info"
              :disabled="!state.templateFile || !state.inputDir"
              :loading="state.preloading"
              @click="preloadAllHeaders"
            >
              {{ state.preloadStatus || '🔍 预读取所有标题行' }}
            </el-button>
            <el-button
              type="primary"
              :disabled="!canRun"
              @click="startTask"
            >开始合并</el-button>
            <el-button
              type="warning"
              :disabled="!state.taskId"
              @click="cancelTask"
            >取消</el-button>
          </el-space>
        </el-form-item>
      </el-form>
    </el-card>

    <MergeColumnMappingPanel
      :visible="state.showColumnMappingPanel"
      :rule="state.currentRule"
      :preloaded-data="state.currentRule?.preloadedHeaders"
      :initial-remove-columns="state.currentRule?.removeColumnsByHeader || []"
      :initial-column-alias-map="state.currentRule?.columnAliasMap || {}"
      @confirm="handleColumnMappingConfirm"
      @cancel="handleColumnMappingCancel"
    />

    <LogPanel :lines="state.logs" @clear="state.logs = []" />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive } from "vue";
import LogPanel from "../components/LogPanel.vue";
import MergeColumnMappingPanel from "../components/MergeColumnMappingPanel.vue";

const state = reactive({
  templateFile: "",
  inputDir: "",
  outputDir: "",
  taskId: "",
  status: "idle",
  progress: 0,
  logs: [],
  preloading: false,
  preloadStatus: "",
  showColumnMappingPanel: false,
  currentRule: null,
  templateSheetNames: [],
  mergeSheetRules: [],
});

let unsubTask = null;
const MAX_LOG_LINES = 500;

const canRun = computed(() => !!state.templateFile && !!state.inputDir && !!state.outputDir);

const statusType = computed(() => {
  if (state.status === "running") return "warning";
  if (state.status === "done") return "success";
  if (state.status === "error") return "danger";
  return "info";
});

function pushLog(line) {
  state.logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
  if (state.logs.length > MAX_LOG_LINES) state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
}

function getApi() {
  const api = window.excelTools;
  if (!api) throw new Error("window.excelTools 不存在");
  return api;
}

// ─── 预读取所有标题行 ────────────────────────────

async function preloadAllHeaders() {
  if (!state.templateFile || !state.inputDir) {
    ElMessage.warning("请先选择模板文件和子表目录");
    return;
  }
  state.preloading = true;
  state.preloadStatus = "⏳ 正在读取...";
  state.logs = [];
  try {
    // 从当前 rules 配置读取 sheetRules
    const api = getApi();
    const rulesConfig = await api.loadRules();
    const rules = (rulesConfig.mergeSheetRules || rulesConfig.sheetRules || [])
      .filter((r) => r.enabled !== false)
      .map((r) => ({
        sheetName: r.sheetName,
        outputSheetName: r.outputSheetName || r.sheetName,
        headerRows: r.headerRows || 1,
        removeColumnsByHeader: r.removeColumnsByHeader || [],
        columnAliasMap: r.columnAliasMap || {},
        preloadedHeaders: null,
      }));

    if (rules.length === 0) {
      ElMessage.warning("没有启用的 sheet 规则，请在 defaultRules.json 中配置");
      state.preloadStatus = "❌ 无规则";
      state.preloading = false;
      return;
    }

    // 调用后端预读取
    const result = await api.preloadMergeHeaders({
      inputDir: state.inputDir,
      templateFile: state.templateFile,
      rules,
    });

    const returnedRules = result.rules || [];
    if (returnedRules.length === 0) {
      ElMessage.warning("预读取未返回数据");
      state.preloadStatus = "❌ 无数据";
      state.preloading = false;
      return;
    }

    // 存到 state
    state.mergeSheetRules = returnedRules;

    // 保存到配置文件
    const updatedConfig = { ...rulesConfig };
    updatedConfig.mergeSheetRules = returnedRules.map((r) => ({
      enabled: true,
      sheetName: r.sheetName,
      outputSheetName: r.outputSheetName,
      headerRows: r.headerRows,
      removeColumnsByHeader: r.removeColumnsByHeader || [],
      columnAliasMap: r.columnAliasMap || {},
      preloadedHeaders: r.preloadedHeaders,
    }));
    await api.saveRules(updatedConfig);

    const totalCols = returnedRules.reduce((sum, r) => {
      const ph = r.preloadedHeaders;
      if (!ph) return sum;
      return sum + (ph.templateHeaders || []).length;
    }, 0);
    state.preloadStatus = `✅ 已预读取 (${returnedRules.length} rule, ${totalCols} 列)`;
    ElMessage.success(`预读取完成：${returnedRules.length} 个规则`);

    // 预读完成后立即打开第一个规则的面板供检查
    state.currentRule = returnedRules[0];
    state.showColumnMappingPanel = true;
  } catch (err) {
    state.preloadStatus = "❌ 读取失败";
    ElMessage.error(err.message || "预读取失败");
    pushLog(`预读取失败：${err.message || "unknown error"}`);
  } finally {
    state.preloading = false;
  }
}

// ─── 列头映射面板 ────────────────────────────────

function handleColumnMappingConfirm(data) {
  const rule = state.currentRule;
  if (!rule) return;
  rule.removeColumnsByHeader = data.removeColumnsByHeader || [];
  rule.columnAliasMap = rule.columnAliasMap || {};
  state.showColumnMappingPanel = false;
  const delCount = (data.removeColumnsByHeader || []).length;
  ElMessage.success(`已保存${delCount > 0 ? `（删除了 ${delCount} 列）` : ''}`);

  // 保存到配置文件
  saveRulesToConfig();
}

function handleColumnMappingCancel() {
  state.showColumnMappingPanel = false;
}

async function saveRulesToConfig() {
  try {
    const api = getApi();
    const rulesConfig = await api.loadRules();
    rulesConfig.mergeSheetRules = (rulesConfig.mergeSheetRules || []).map((oldRule) => {
      const updated = state.mergeSheetRules.find(
        (r) => (r.outputSheetName || r.sheetName) === (oldRule.outputSheetName || oldRule.sheetName)
      );
      if (updated) {
        return {
          ...oldRule,
          removeColumnsByHeader: updated.removeColumnsByHeader || [],
          columnAliasMap: updated.columnAliasMap || {},
          preloadedHeaders: updated.preloadedHeaders,
        };
      }
      return oldRule;
    });
    await api.saveRules(rulesConfig);
  } catch {
    // 静默
  }
}

// ─── 基础操作 ────────────────────────────────────

async function pickTemplate() {
  const result = await getApi().selectTemplateFile();
  if (!result) return;
  state.templateFile = result.path;
  state.mergeSheetRules = [];
  state.currentRule = null;
}

async function pickInputDir() {
  const dir = await getApi().selectOutputDir();
  if (!dir) return;
  state.inputDir = dir;
  state.mergeSheetRules = [];
  state.currentRule = null;
}

async function pickOutputDir() {
  const dir = await getApi().selectOutputDir();
  if (!dir) return;
  state.outputDir = dir;
}

async function startTask() {
  try {
    state.status = "running";
    state.progress = 0;
    state.logs = [];
    // 加载完整配置
    const rulesConfig = await getApi().loadRules();
    const { taskId } = await getApi().startMergeTask({
      inputDir: state.inputDir,
      outputDir: state.outputDir,
      rules: {
        templateFile: state.templateFile,
        merge: rulesConfig.merge || {},
        sheetRules: state.mergeSheetRules.length > 0
          ? state.mergeSheetRules
          : (rulesConfig.mergeSheetRules || rulesConfig.sheetRules || []),
      },
    });
    state.taskId = taskId;
    pushLog(`任务启动：${taskId}`);
  } catch (err) {
    state.status = "error";
    pushLog(`启动失败：${err.message}`);
  }
}

async function cancelTask() {
  if (!state.taskId) return;
  const { cancelled } = await getApi().cancelTask(state.taskId);
  if (cancelled) {
    pushLog("任务已取消");
    state.status = "idle";
    state.taskId = "";
  }
}

function handleEvent(event) {
  if (!state.taskId || event.taskId !== state.taskId) return;
  if (event.type === "log") pushLog(`${event.level.toUpperCase()} ${event.message}`);
  else if (event.type === "progress") {
    state.progress = event.progress;
    pushLog(`进度 ${event.progress}% - ${event.stage}`);
  } else if (event.type === "done") {
    state.status = "done";
    state.taskId = "";
    pushLog("合并完成");
    ElMessage.success("合并完成");
  } else if (event.type === "error") {
    state.status = "error";
    state.taskId = "";
    pushLog(`失败：${event.error.message}`);
    ElMessage.error(event.error.message);
  } else if (event.type === "cancelled") {
    state.status = "idle";
    state.taskId = "";
  }
}

onMounted(() => {
  unsubTask = getApi().onTaskEvent(handleEvent);
});
onUnmounted(() => {
  if (unsubTask) unsubTask();
});
</script>
