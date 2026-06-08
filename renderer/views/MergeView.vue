<template>
  <!-- 骨架屏：首次加载时显示 -->
  <div v-if="pageLoading" class="merge-skeleton">
    <div class="skeleton-card">
      <div class="skeleton-line w-40 h-6 mb-16"></div>
      <div class="skeleton-line w-full h-10 mb-12"></div>
      <div class="skeleton-line w-full h-10 mb-12"></div>
      <div class="skeleton-line w-60 h-10 mb-12"></div>
      <div class="skeleton-line w-40 h-10"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line w-32 h-6 mb-16"></div>
      <div class="skeleton-line w-full h-32"></div>
    </div>
  </div>

  <div v-else class="merge-grid">
    <el-card class="panel-card">
      <template #header>
        <div class="card-header-row">
          <span>合并汇总配置</span>
          <div style="display: flex; gap: 8px">
            <el-button text type="primary" size="small" @click="openAliasDialog">Sheet 别名</el-button>
            <el-button text type="primary" size="small" @click="openTemplateDialog">⚙ 模板</el-button>
          </div>
        </div>
      </template>

      <el-form label-width="120px">
        <el-form-item label="数据目录">
          <div class="drop-zone" :class="{ 'drop-zone--active': inputDrop.isDragOver }"
               @dragover.prevent="inputDrop.onDragOver"
               @dragenter="inputDrop.onDragEnter"
               @dragleave="inputDrop.onDragLeave"
               @drop="onInputDirDrop">
            <el-input v-model="state.inputDir" placeholder="选择或输入数据目录路径">
              <template #append><el-button @click="pickInputDir">选择</el-button></template>
            </el-input>
          </div>
        </el-form-item>
        <el-form-item label="输出目录">
          <div class="drop-zone" :class="{ 'drop-zone--active': outputDrop.isDragOver }"
               @dragover.prevent="outputDrop.onDragOver"
               @dragenter="outputDrop.onDragEnter"
               @dragleave="outputDrop.onDragLeave"
               @drop="onOutputDirDrop">
            <el-input v-model="state.outputDir" placeholder="选择或输入输出目录">
              <template #append><el-button @click="pickOutputDir">选择</el-button></template>
            </el-input>
          </div>
        </el-form-item>
        <el-form-item label="排序依据 Sheet">
          <el-select v-model="state.merge.orderSheetName" filterable style="width: 100%">
            <el-option v-for="name in state.templateSheetNames" :key="name" :label="name" :value="name" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序列">
          <el-input v-model="state.merge.orderColumn" maxlength="3" style="width: 84px" />
        </el-form-item>
        <el-form-item label="未知供应商">
          <el-switch v-model="state.merge.appendUnknownVendorsToEnd" />
          <el-text style="margin-left: 8px; color: #888">追加到末尾</el-text>
        </el-form-item>
        <el-form-item label="输出文件名">
          <el-input v-model="state.merge.outputName" placeholder="默认：合并汇总.xlsx" />
        </el-form-item>
        <el-form-item label="任务状态">
          <el-tag :type="statusType">{{ state.status }}</el-tag>
          <el-progress style="margin-left: 12px; width: 240px" :percentage="state.progress" :stroke-width="14" />
        </el-form-item>
      </el-form>

      <div class="divider"></div>
      <div class="action-bar">
        <el-button type="primary" @click="saveMergeRules">保存规则</el-button>
        <el-button @click="addRule">新增规则</el-button>
        <el-button
          type="info"
          :disabled="!state.inputDir || !currentTemplatePath"
          :loading="state.preloading"
          @click="preloadAllHeaders"
        >
          {{ state.preloadStatus || '🔍 预读取所有标题行' }}
        </el-button>
        <el-button type="success" :disabled="!canRun" @click="startTask">开始合并</el-button>
        <el-button type="warning" :disabled="!state.taskId" @click="cancelTask">取消任务</el-button>
      </div>
    </el-card>

    <el-card class="panel-card">
      <template #header><span>合并规则（按 sheet）</span></template>
      <MergeRuleTable
        :rules="state.mergeSheetRules"
        :source-sheet-names="state.sourceSheetNames"
        :template-sheet-names="state.templateSheetNames"
        @remove="removeRule"
        @select="selectRule"
      />
    </el-card>

    <LogPanel :lines="state.logs" @clear="state.logs = []" />

    <MergeColumnMappingPanel
      :visible="state.showColumnMappingPanel"
      :rule="state.currentRule"
      :preloaded-data="state.currentRule?.preloadedHeaders"
      :initial-remove-columns="state.currentRule?.removeColumnsByHeader || []"
      :initial-column-alias-map="state.currentRule?.columnAliasMap || {}"
      @confirm="handleColumnMappingConfirm"
      @cancel="handleColumnMappingCancel"
    />

    <!-- 模板选择对话框 -->
    <el-dialog v-model="state.showTemplateDialog" title="模板文件设置" width="560px" append-to-body>
      <p class="dialog-hint">合并模板用于提供样式与排序基准。</p>
      <el-table :data="state.templateList" style="width: 100%" max-height="320" stripe>
        <el-table-column label="" width="48">
          <template #default="{ row }">
            <el-radio v-model="state.selectedTemplatePath" :value="row.path" :label="row.path"
              @change="onTemplateSelect(row)">&nbsp;</el-radio>
          </template>
        </el-table-column>
        <el-table-column label="模板名称" min-width="180">
          <template #default="{ row }">
            <span>{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="90">
          <template #default="{ row }">{{ formatFileSize(row.size) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-popconfirm title="确定删除此模板？" confirm-button-text="删除"
              @confirm="handleDeleteTemplate(row)">
              <template #reference><el-button text type="danger" size="small">删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="state.templateList.length === 0" class="empty-state">暂无模板，请导入</div>
      <template #footer>
        <el-space wrap>
          <el-button @click="handleImportTemplate">📂 导入模板</el-button>
          <el-button @click="handleClearTemplate">不使用模板</el-button>
          <el-button type="primary" @click="dialogConfirm">确定</el-button>
          <el-button @click="state.showTemplateDialog = false">取消</el-button>
        </el-space>
      </template>
    </el-dialog>
    <el-dialog v-model="state.showAliasDialog" title="合并 Sheet 别名" width="560px" append-to-body>
      <p class="dialog-hint">格式示例：{"零跑退回":"领跑良品退回"}</p>
      <el-input v-model="state.aliasText" type="textarea" :rows="12" />
      <template #footer>
        <el-space wrap>
          <el-button @click="state.showAliasDialog = false">取消</el-button>
          <el-button type="primary" @click="saveAliasDialog">保存</el-button>
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, reactive } from "vue";
import { useDropZone } from "../composables/useDropZone";
import LogPanel from "../components/LogPanel.vue";
import MergeRuleTable from "../components/MergeRuleTable.vue";
import MergeColumnMappingPanel from "../components/MergeColumnMappingPanel.vue";
import { buildMergeSourceSheetOptions } from "../utils/mergeSheetOptions.browser";

const state = reactive({
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
  showTemplateDialog: false,
  showAliasDialog: false,
  templateList: [],
  selectedTemplatePath: "",
  aliasText: "",
  sourceSheetNames: [],
  templateSheetNames: [],
  mergeSheetRules: [],
  rules: {},
  merge: {
    orderSheetName: "日报",
    orderColumn: "C",
    appendUnknownVendorsToEnd: true,
    outputName: "合并汇总.xlsx",
  },
});

const inputDrop = reactive(useDropZone());
const outputDrop = reactive(useDropZone());

let unsubTask = null;
const MAX_LOG_LINES = 500;

const currentTemplatePath = computed(() => {
  return state.rules.merge?.templateFile || "";
});

const canRun = computed(() => {
  return !!state.inputDir && !!state.outputDir && !!currentTemplatePath.value && state.mergeSheetRules.length > 0;
});

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

function deepClone(v) { return JSON.parse(JSON.stringify(v)); }

function stageError(stage, error) {
  const message = error?.message || String(error || "unknown error");
  return new Error(`${stage}：${message}`);
}

function formatFileSize(size) {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeMergeRule(rule = {}) {
  return {
    enabled: rule.enabled !== false,
    sheetName: rule.sheetName || "",
    headerRows: Number(rule.headerRows || 1),
    splitColumn: rule.splitColumn || "C",
    outputSheetName: rule.outputSheetName || rule.sheetName || "",
    skipEmpty: rule.skipEmpty !== false,
    removeColumnsByHeader: Array.isArray(rule.removeColumnsByHeader) ? [...rule.removeColumnsByHeader] : [],
    columnAliasMap: rule.columnAliasMap && typeof rule.columnAliasMap === "object" ? { ...rule.columnAliasMap } : {},
    sortColumn: rule.sortColumn || "",
    sortOrder: rule.sortOrder === "desc" ? "desc" : rule.sortOrder === "asc" ? "asc" : "",
    preloadedHeaders: null,
  };
}

// ─── 模板管理 ────────────────────────────────────

async function openTemplateDialog() {
  await loadTemplateList();
  state.showTemplateDialog = true;
}

function openAliasDialog() {
  state.aliasText = JSON.stringify(state.rules.merge?.sheetNameAliases || {}, null, 2);
  state.showAliasDialog = true;
}

async function loadTemplateList() {
  const list = await getApi().listTemplates("merge");
  state.templateList = list;
  const currentPath = currentTemplatePath.value;
  state.selectedTemplatePath = currentPath && list.find((t) => t.path === currentPath) ? currentPath :
    (list.length > 0 ? list[0].path : "");
}

function onTemplateSelect(row) { state.selectedTemplatePath = row.path; }

async function handleImportTemplate() {
  const result = await getApi().selectTemplateFile();
  if (!result) return;
  try {
    await getApi().importTemplate("merge", result.path);
    ElMessage.success(`模板「${result.name}」导入成功`);
    await loadTemplateList();
  } catch (err) { ElMessage.error(err.message || "导入失败"); }
}

async function handleDeleteTemplate(row) {
  try {
    await getApi().deleteTemplate("merge", row.name);
    ElMessage.success(`模板「${row.name}」已删除`);
    if (state.selectedTemplatePath === row.path) state.selectedTemplatePath = "";
    await loadTemplateList();
  } catch (err) { ElMessage.error(err.message || "删除失败"); }
}

function handleClearTemplate() { state.selectedTemplatePath = ""; }

async function dialogConfirm() {
  if (!state.rules.merge) state.rules.merge = {};
  state.rules.merge.templateFile = state.selectedTemplatePath || "";
  state.showTemplateDialog = false;
  await loadTemplateSheetNames();
  await saveMergeRules();
}

async function saveAliasDialog() {
  try {
    const parsed = state.aliasText.trim() ? JSON.parse(state.aliasText) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Sheet 别名必须是 JSON 对象");
    }
    if (!state.rules.merge) state.rules.merge = {};
    state.rules.merge.sheetNameAliases = parsed;
    await saveMergeRules();
    await refreshSourceSheetNames();
    state.showAliasDialog = false;
  } catch (error) {
    ElMessage.error(error.message || "别名保存失败");
  }
}

async function loadTemplateSheetNames() {
  const tplPath = currentTemplatePath.value;
  if (!tplPath) { state.templateSheetNames = []; return; }
  try { state.templateSheetNames = await getApi().getSheetNames(tplPath); }
  catch { state.templateSheetNames = []; }
}

async function refreshSourceSheetNames() {
  const excludedPaths = currentTemplatePath.value ? [currentTemplatePath.value] : [];
  const scannedNames = state.inputDir
    ? await getApi().getDirectorySheetNames(state.inputDir, excludedPaths)
    : [];
  state.sourceSheetNames = buildMergeSourceSheetOptions(
    scannedNames,
    state.templateSheetNames,
    state.mergeSheetRules
  );
}

// ─── 规则加载/保存 ───────────────────────────────

async function loadRules() {
  const rules = await getApi().loadRules();
  state.rules = rules || {};
  const mc = state.rules.merge || {};
  state.merge = {
    orderSheetName: mc.orderSheetName || "日报",
    orderColumn: mc.orderColumn || "C",
    appendUnknownVendorsToEnd: mc.appendUnknownVendorsToEnd !== false,
    outputName: mc.outputName || "合并汇总.xlsx",
  };
  state.inputDir = mc.inputDir || state.rules.lastMergeInputDir || "";
  state.outputDir = state.rules.lastMergeOutputDir || state.rules.defaultOutputDir || "";
  const seed = state.rules.mergeSheetRules || [];
  state.mergeSheetRules = seed.map((r) => normalizeMergeRule(r));
  await loadTemplateSheetNames();

  // sourceSheetNames intentionally NOT loaded here — deferred to when
  // the user picks an input directory or template, avoiding a full
  // directory scan on every mount.
}

async function saveMergeRules() {
  const next = deepClone(state.rules || {});
  next.merge = { ...(next.merge || {}), ...deepClone(state.merge), inputDir: state.inputDir };
  next.mergeSheetRules = state.mergeSheetRules.map((r) => normalizeMergeRule(r));
  next.lastMergeInputDir = state.inputDir;
  next.lastMergeOutputDir = state.outputDir;
  if (!next.merge) next.merge = {};
  next.merge.templateFile = currentTemplatePath.value;
  await getApi().saveRules(next);
  state.rules = next;
  ElMessage.success("合并规则已保存");
}

// ─── 规则管理 ────────────────────────────────────

function addRule() {
  state.mergeSheetRules.push(normalizeMergeRule({ enabled: true, headerRows: 1, splitColumn: "C", skipEmpty: true }));
  refreshSourceSheetNames();
}

function removeRule(index) {
  state.mergeSheetRules.splice(index, 1);
  refreshSourceSheetNames();
}

// ─── 预读取所有标题行 ────────────────────────────

async function preloadAllHeaders() {
  if (!state.inputDir || !currentTemplatePath.value) {
    ElMessage.warning("请先选择数据目录和模板文件");
    return;
  }
  state.preloading = true;
  state.preloadStatus = "⏳ 正在读取...";
  state.logs = [];
  state.progress = 0;
  state.taskId = 'preload-headers';
  try {
    const api = getApi();
    const rules = state.mergeSheetRules
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
      ElMessage.warning("没有启用的 sheet 规则");
      state.preloadStatus = "❌ 无规则";
      state.preloading = false;
      return;
    }

    const requestPayload = deepClone({
      inputDir: state.inputDir,
      templateFile: currentTemplatePath.value,
      orderSheetName: state.merge.orderSheetName,
      orderColumn: state.merge.orderColumn,
      sheetNameAliases: state.rules.merge?.sheetNameAliases || {},
      rules,
    });

    try {
      structuredClone(requestPayload);
      pushLog("预读取阶段1/3：请求参数可克隆");
    } catch (error) {
      throw stageError("预读取阶段1/3 请求参数不可克隆", error);
    }

    let result;
    try {
      result = await api.preloadMergeHeaders(requestPayload);
      pushLog("预读取阶段2/3：IPC 已返回");
    } catch (error) {
      throw stageError("预读取阶段2/3 IPC 调用失败", error);
    }

    if (result._error) { throw new Error(result._error); }
    try {
      structuredClone(result);
      pushLog("预读取阶段2/3：返回结果可克隆");
    } catch (error) {
      throw stageError("预读取阶段2/3 返回结果不可克隆", error);
    }
    const returnedRules = result.rules || [];
    if (returnedRules.length === 0) {
      state.preloadStatus = "❌ 无数据";
      state.preloading = false;
      return;
    }

    // 更新 mergeSheetRules 中的 preloadedHeaders
    try {
      for (const updated of returnedRules) {
        const match = state.mergeSheetRules.find(
          (r) => (r.outputSheetName || r.sheetName) === (updated.outputSheetName || updated.sheetName)
        );
        if (match) match.preloadedHeaders = deepClone(updated.preloadedHeaders);
      }
      pushLog("预读取阶段3/3：页面状态回填完成");
    } catch (error) {
      throw stageError("预读取阶段3/3 页面回填失败", error);
    }

    const totalCols = returnedRules.reduce((s, r) => s + ((r.preloadedHeaders?.templateHeaders || []).length), 0);
    state.progress = 100;
    state.preloadStatus = `✅ 已预读取 (${returnedRules.length} rule, ${totalCols} 列)`;
    ElMessage.success(`预读取完成：${returnedRules.length} 个规则`);

    // 预读取完成，用户可手动点击"列头映射"按钮打开面板
  } catch (err) {
    state.preloadStatus = "❌ 读取失败";
    ElMessage.error(err.message || "预读取失败");
    pushLog(`预读取失败：${err.message || "unknown error"}`);
  } finally {
    state.taskId = '';
    state.preloading = false;
  }
}

// ─── 列头映射面板 ────────────────────────────────

function selectRule(index) {
  const rule = state.mergeSheetRules[index];
  if (!rule) return;
  if (!rule.preloadedHeaders) {
    ElMessage.warning("请先点击「预读取所有标题行」");
    return;
  }
  state.currentRule = rule;
  state.showColumnMappingPanel = true;
}

function handleColumnMappingConfirm(data) {
  const rule = state.currentRule;
  if (!rule) return;
  rule.removeColumnsByHeader = data.removeColumnsByHeader || [];
  state.showColumnMappingPanel = false;
  saveMergeRules();
}

function handleColumnMappingCancel() {
  state.showColumnMappingPanel = false;
}

// ─── 基础操作 ────────────────────────────────────

async function pickInputDir() {
  const dir = await getApi().selectOutputDir();
  if (!dir) return;
  state.inputDir = dir;
  await refreshSourceSheetNames();
}

async function pickOutputDir() {
  const dir = await getApi().selectOutputDir();
  if (!dir) return;
  state.outputDir = dir;
}

async function onInputDirDrop(e) {
  const dirPath = inputDrop.onDrop(e);
  if (!dirPath) return;
  state.inputDir = dirPath;
  await refreshSourceSheetNames();
}

function onOutputDirDrop(e) {
  const dirPath = outputDrop.onDrop(e);
  if (!dirPath) return;
  state.outputDir = dirPath;
}

async function startTask() {
  try {
    state.status = "running";
    state.progress = 0;
    state.logs = [];
    const requestRules = deepClone(state.rules || {});
    requestRules.merge = {
      ...(requestRules.merge || {}),
      ...deepClone(state.merge),
      inputDir: state.inputDir,
      templateFile: currentTemplatePath.value,
    };
    requestRules.mergeSheetRules = state.mergeSheetRules.map((r) => normalizeMergeRule(r));
    const { taskId } = await getApi().startMergeTask({
      inputDir: state.inputDir, outputDir: state.outputDir, rules: requestRules,
    });
    state.taskId = taskId;
    pushLog(`任务启动：${taskId}`);
  } catch (err) {
    state.status = "error";
    ElMessage.error(err.message || "启动任务失败");
    pushLog(`启动失败：${err.message || "unknown error"}`);
  }
}

async function cancelTask() {
  if (!state.taskId) return;
  const { cancelled } = await getApi().cancelTask(state.taskId);
  if (cancelled) { pushLog("任务已取消"); state.status = "idle"; state.progress = 0; state.taskId = ""; }
}

function handleEvent(event) {
  if (!state.taskId || event.taskId !== state.taskId) return;
  if (event.type === "log") pushLog(`${event.level.toUpperCase()} ${event.message}`);
  else if (event.type === "progress") { state.progress = event.progress; pushLog(`进度 ${event.progress}% - ${event.stage}`); }
  else if (event.type === "done") { state.status = "done"; state.taskId = ""; pushLog("合并完成"); ElMessage.success("合并完成"); }
  else if (event.type === "error") { state.status = "error"; state.taskId = ""; pushLog(`失败：${event.error.message}`); ElMessage.error(event.error.message); }
  else if (event.type === "cancelled") { state.status = "idle"; state.taskId = ""; }
}

const pageLoading = ref(true);
const emit = defineEmits(['ready']);

onMounted(async () => {
  try {
    await loadRules();
    unsubTask = getApi().onTaskEvent(handleEvent);
  } catch (err) {
    ElMessage.error(err.message || "初始化失败");
    pushLog(`初始化失败：${err.message || "unknown error"}`);
  } finally {
    pageLoading.value = false;
    emit('ready');
  }
});

onUnmounted(() => { if (unsubTask) unsubTask(); });
</script>

<style scoped>
/* ---- 骨架屏 ---- */
.merge-skeleton {
  display: grid;
  gap: 16px;
}
.skeleton-card {
  background: var(--bg-card);
  border-radius: var(--radius-md);
  padding: 24px 20px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
}
.skeleton-line {
  background: linear-gradient(90deg, var(--border-light) 25%, #e8ecf0 50%, var(--border-light) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}
.w-40 { width: 40%; }
.w-60 { width: 60%; }
.w-32 { width: 32%; }
.w-full { width: 100%; }
.h-6 { height: 6px; }
.h-10 { height: 10px; }
.h-32 { height: 32px; }
.mb-16 { margin-bottom: 16px; }
.mb-12 { margin-bottom: 12px; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.divider {
  height: 1px;
  background: var(--border-light);
  margin: 8px 0 16px;
}
.action-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.dialog-hint {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0 0 12px;
}
.empty-state {
  text-align: center;
  color: var(--text-muted);
  padding: 32px 0;
}
</style>
