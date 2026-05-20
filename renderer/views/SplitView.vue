<template>
  <div class="split-grid">
    <el-card class="panel-card">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span>任务配置</span>
          <el-button text type="primary" @click="openTemplateDialog">
            ⚙ 模板
          </el-button>
        </div>
      </template>
      <el-form label-width="100px">
        <el-form-item label="源文件">
          <div class="drop-zone" :class="{ 'drop-zone--active': sourceDrop.isDragOver }"
               @dragover.prevent="sourceDrop.onDragOver"
               @dragenter="sourceDrop.onDragEnter"
               @dragleave="sourceDrop.onDragLeave"
               @drop="onSourceFileDrop">
            <el-input v-model="state.inputFile" placeholder="请选择 xlsx 文件" readonly>
              <template #append>
                <el-button @click="pickInputFile">选择</el-button>
              </template>
            </el-input>
          </div>
        </el-form-item>
        <el-form-item v-if="state.fileInfo.name" label="文件信息">
          <el-text>
            {{ state.fileInfo.name }}（{{ formatFileSize(state.fileInfo.size) }}）
          </el-text>
        </el-form-item>
        <el-form-item label="输出目录">
          <div class="drop-zone" :class="{ 'drop-zone--active': outputDrop.isDragOver }"
               @dragover.prevent="outputDrop.onDragOver"
               @dragenter="outputDrop.onDragEnter"
               @dragleave="outputDrop.onDragLeave"
               @drop="onOutputDirDrop">
            <el-input v-model="state.outputDir" placeholder="请选择输出目录" readonly>
              <template #append>
                <el-button @click="pickOutputDir">选择</el-button>
              </template>
            </el-input>
          </div>
        </el-form-item>
        <el-form-item label="文件名后缀">
          <el-input
            v-model="state.rules.fileName.suffix"
            placeholder="例如：日报表（会拼接在拆分键后面）"
          />
        </el-form-item>
        <el-form-item label="任务状态">
          <el-tag :type="statusType">{{ state.status }}</el-tag>
          <el-progress
            style="margin-left: 12px; width: 240px"
            :percentage="state.progress"
            :stroke-width="14"
          />
        </el-form-item>
      </el-form>
      <el-space>
        <el-button type="primary" @click="saveRules">保存规则</el-button>
        <el-button @click="addRule">新增规则</el-button>
        <el-button type="success" :disabled="!canRun" @click="startTask">开始拆分</el-button>
        <el-button type="warning" :disabled="!state.taskId" @click="cancelTask">取消任务</el-button>
      </el-space>
    </el-card>

    <el-card class="panel-card">
      <template #header><div>拆分规则</div></template>
      <el-alert
        v-if="state.sheetWarnings.length > 0"
        :title="`Sheet 名称不匹配（${state.sheetWarnings.length} 项）`"
        type="warning"
        show-icon
        closable
        @close="state.sheetWarnings = []"
        style="margin-bottom: 12px"
      >
        <template #default>
          <div v-for="(w, i) in state.sheetWarnings" :key="i" style="font-size: 13px; line-height: 1.8">
            {{ i + 1 }}. {{ w }}
          </div>
        </template>
      </el-alert>
      <RuleTable
        :rules="state.rules.sheetRules"
        :source-sheet-names="state.sourceSheetNames"
        :template-sheet-names="state.templateSheetNames"
        @remove="removeRule"
      />
    </el-card>

    <LogPanel :lines="state.logs" @clear="state.logs = []" />

    <el-dialog v-model="state.showTemplateDialog" title="模板文件设置" width="560px" append-to-body>
      <p style="font-size: 13px; color: #888; margin: 0 0 12px 0;">
        模板用于提供列宽、字体、底色等样式参考。不设置则从源文件获取样式。
      </p>

      <!-- Template list -->
      <el-table :data="state.templateList" style="width: 100%" max-height="320" stripe>
        <el-table-column label="" width="48">
          <template #default="{ row }">
            <el-radio
              v-model="state.selectedTemplatePath"
              :value="row.path"
              :label="row.path"
              @change="onTemplateSelect(row)"
            >&nbsp;</el-radio>
          </template>
        </el-table-column>
        <el-table-column label="模板名称" min-width="180">
          <template #default="{ row }">
            <span>{{ row.name }}</span>
            <el-tag v-if="row.isDefault" size="small" type="warning" style="margin-left: 6px">默认</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="90">
          <template #default="{ row }">
            {{ formatFileSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-popconfirm
              v-if="!row.isDefault"
              title="确定删除此模板？"
              confirm-button-text="删除"
              @confirm="handleDeleteTemplate(row)"
            >
              <template #reference>
                <el-button text type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
            <span v-else style="color: #bbb; font-size: 13px">🔒 不可删除</span>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="state.templateList.length === 0" style="text-align: center; color: #999; padding: 32px 0">
        暂无模板，请导入
      </div>

      <template #footer>
        <el-space wrap>
          <el-button @click="handleImportTemplate">📂 导入模板</el-button>
          <el-button @click="handleResetDefault">恢复默认</el-button>
          <el-button @click="handleClearTemplate">不使用模板</el-button>
          <el-button type="primary" :loading="state.templateLoading" :disabled="state.templateLoading" @click="dialogConfirm">
            {{ state.templateLoading ? '加载 Sheet 名称中...' : '确定' }}
          </el-button>
          <el-button @click="state.showTemplateDialog = false">取消</el-button>
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, watch } from "vue";
import { useDropZone } from "../composables/useDropZone";

import RuleTable from "../components/RuleTable.vue";
import LogPanel from "../components/LogPanel.vue";

const state = reactive({
  inputFile: "",
  outputDir: "",
  taskId: "",
  fileInfo: {
    name: "",
    size: 0
  },
  status: "idle",
  progress: 0,
  logs: [],
  showTemplateDialog: false,
  templateLoading: false, // 模板 sheet 名加载中（防连点 + 显示加载态）
  templateList: [],
  selectedTemplatePath: "",
  sourceSheetNames: [],
  templateSheetNames: [],
  sheetWarnings: [],
  rules: {
    appName: "Excel Tools",
    defaultOutputDir: ".\\output",
    templateFile: "",
    overwriteIfExists: false,
    ifExistsStrategy: "timestamp",
    fileName: {
      source: "splitKey",
      prefix: "",
      suffix: "",
      customName: "",
      sanitizeWindowsName: true,
      maxLength: 120
    },
    split: {
      skipEmptySplitKey: true,
      trimSplitKey: true
    },
    sheetRules: []
  },
  _loading: true // suppress auto-save during initial load
});

const sourceDrop = reactive(useDropZone());
const outputDrop = reactive(useDropZone());

let unsubscribe = null;
let _autoSaveTimer = null;
const AUTO_SAVE_DELAY = 1500;
const MAX_LOG_LINES = 1000;

const canRun = computed(
  () =>
    !!state.inputFile &&
    !!state.outputDir &&
    Array.isArray(state.rules.sheetRules) &&
    state.rules.sheetRules.length > 0
);

const statusType = computed(() => {
  if (state.status === "running") return "warning";
  if (state.status === "done") return "success";
  if (state.status === "error") return "danger";
  return "info";
});

function pushLog(line) {
  state.logs.push(`[${new Date().toLocaleTimeString()}] ${line}`);
  if (state.logs.length > MAX_LOG_LINES) {
    state.logs.splice(0, state.logs.length - MAX_LOG_LINES);
  }
}

function getApi() {
  const api = window.excelTools;
  if (!api) {
    throw new Error(
      "桌面桥接未就绪：window.excelTools 不存在。请通过 Electron 窗口运行，而不是直接浏览器页面。"
    );
  }
  return api;
}

function formatFileSize(size) {
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

async function validateSheetNames(filePath) {
  try {
    const actualSheets = await getApi().getSheetNames(filePath);
    const enabledRules = state.rules.sheetRules.filter(
      (r) => r.enabled && r.sheetName && r.sheetName.trim()
    );
    const ruleSheetNames = enabledRules.map((r) => r.sheetName);
    const warnings = [];

    // 规则中有但文件中没有
    for (const rule of enabledRules) {
      if (!actualSheets.includes(rule.sheetName)) {
        warnings.push(`规则中的 sheet「${rule.sheetName}」在文件中不存在（文件中有：${actualSheets.join("、")}）`);
      }
    }

    // 文件中有但规则没覆盖
    if (enabledRules.length > 0) {
      for (const sheet of actualSheets) {
        if (!ruleSheetNames.includes(sheet)) {
          warnings.push(`文件中的 sheet「${sheet}」未配置拆分规则`);
        }
      }
    }

    state.sheetWarnings = warnings;
    if (warnings.length > 0) {
      warnings.forEach((w) => pushLog(`⚠ ${w}`));
    } else {
      pushLog("✓ 文件 sheet 名称与规则全部匹配");
    }
  } catch (error) {
    pushLog(`读取 sheet 名称失败：${error.message}`);
  }
}

async function pickInputFile() {
  const result = await getApi().selectInputFile();
  if (!result) return;
  await applyInputFile(result.path, result.name, result.size || 0);
}

async function applyInputFile(path, name, size) {
  state.inputFile = path;
  state.fileInfo.name = name;
  state.fileInfo.size = size;

  try {
    const sheets = await getApi().getSheetNames(path);
    state.sourceSheetNames = sheets;

    if (state.rules.sheetRules.length === 0) {
      for (const sheet of sheets) {
        state.rules.sheetRules.push({
          enabled: true,
          sheetName: sheet,
          headerRows: 1,
          splitColumn: "A",
          splitBy: "cellValue",
          outputSheetName: state.templateSheetNames.includes(sheet) ? sheet : "",
          skipEmpty: true
        });
      }
    }
  } catch {
    state.sourceSheetNames = [];
  }

  await validateSheetNames(path);
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
    await applyInputFile(info.path, info.name, info.size || 0);
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function pickOutputDir() {
  const dir = await getApi().selectOutputDir();
  if (!dir) return;
  state.outputDir = dir;
}

function onOutputDirDrop(e) {
  const dirPath = outputDrop.onDrop(e);
  if (!dirPath) return;
  state.outputDir = dirPath;
}

async function loadTemplateList() {
  const list = await getApi().listTemplates();
  state.templateList = list;
  // Auto-select the currently configured template if it exists in the list
  const currentPath = state.rules.templateFile || "";
  if (currentPath) {
    const match = list.find((t) => t.path === currentPath);
    state.selectedTemplatePath = match ? match.path : "";
  } else if (list.length > 0) {
    // Default to the first (default) template
    const defaultTpl = list.find((t) => t.isDefault);
    state.selectedTemplatePath = defaultTpl ? defaultTpl.path : list[0].path;
  } else {
    state.selectedTemplatePath = "";
  }
}

async function openTemplateDialog() {
  await loadTemplateList();
  state.showTemplateDialog = true;
}

function onTemplateSelect(row) {
  state.selectedTemplatePath = row.path;
}

async function handleImportTemplate() {
  const result = await getApi().selectTemplateFile();
  if (!result) return;
  try {
    await getApi().importTemplate(result.path);
    ElMessage.success(`模板「${result.name}」导入成功`);
    await loadTemplateList();
  } catch (err) {
    ElMessage.error(err.message || "导入失败");
  }
}

async function handleDeleteTemplate(row) {
  try {
    await getApi().deleteTemplate(row.name);
    ElMessage.success(`模板「${row.name}」已删除`);
    // If the deleted template was selected, clear selection
    if (state.selectedTemplatePath === row.path) {
      state.selectedTemplatePath = "";
    }
    await loadTemplateList();
  } catch (err) {
    ElMessage.error(err.message || "删除失败");
  }
}

async function handleResetDefault() {
  await loadTemplateList();
  const defaultTpl = state.templateList.find((t) => t.isDefault);
  if (defaultTpl) {
    state.selectedTemplatePath = defaultTpl.path;
  } else {
    ElMessage.warning("默认模板不存在，请导入");
  }
}

function handleClearTemplate() {
  state.selectedTemplatePath = "";
}

let _loadingSheetNames = false; // 并发调用守卫

async function loadTemplateSheetNames() {
  if (_loadingSheetNames) return; // 已有加载中的请求，跳过防竞态
  _loadingSheetNames = true;
  try {
    const tplPath = state.rules.templateFile;
    if (tplPath) {
      try {
        state.templateSheetNames = await getApi().getSheetNames(tplPath);
      } catch {
        state.templateSheetNames = [];
      }
    } else {
      state.templateSheetNames = [];
    }
  } finally {
    _loadingSheetNames = false;
  }
}

async function dialogConfirm() {
  if (state.templateLoading) return; // 已有操作进行中，防连点
  state.templateLoading = true;
  try {
    state.rules.templateFile = state.selectedTemplatePath || "";
    // 先保存规则（轻操作），再异步加载 sheet 名
    await saveRules();
    await loadTemplateSheetNames();
    state.showTemplateDialog = false;
  } catch (err) {
    ElMessage.error(err.message || "模板切换失败");
  } finally {
    state.templateLoading = false;
  }
}

async function loadRules() {
  const rules = await getApi().loadRules();
  state.rules = rules;
  // Restore remembered input file and output dir
  if (rules.lastInputFile) {
    state.inputFile = rules.lastInputFile;
    if (rules._lastFileInfo) {
      state.fileInfo = { ...rules._lastFileInfo };
    }
    // Silently try to validate sheet names (file may not exist)
    try {
      await validateSheetNames(state.inputFile);
    } catch {
      // file might be gone, that's fine
    }
  }
  if (rules.lastOutputDir) {
    state.outputDir = rules.lastOutputDir;
  } else if (rules.defaultOutputDir) {
    state.outputDir = rules.defaultOutputDir;
  }
  // Load template sheet names if a template is configured
  await loadTemplateSheetNames();
}

async function saveRules() {
  await getApi().saveRules(JSON.parse(JSON.stringify(state.rules)));
  ElMessage.success("规则已保存");
}

function addRule() {
  state.rules.sheetRules.push({
    enabled: true,
    sheetName: "",
    headerRows: 1,
    splitColumn: "A",
    splitBy: "cellValue",
    outputSheetName: "",
    skipEmpty: true
  });
}

function removeRule(index) {
  state.rules.sheetRules.splice(index, 1);
}

// 监控规则中 sheet 名称变化，自动重新比对
watch(
  () =>
    state.rules.sheetRules
      .filter((r) => r.enabled)
      .map((r) => r.sheetName)
      .join("|"),
  () => {
    if (state.inputFile) {
      validateSheetNames(state.inputFile);
    }
  }
);

async function startTask() {
  try {
    state.status = "running";
    state.progress = 0;
    state.logs = [];
    const { taskId } = await getApi().startSplitTask({
      inputFile: state.inputFile,
      outputDir: state.outputDir,
      rules: JSON.parse(JSON.stringify(state.rules))
    });
    state.taskId = taskId;
    pushLog(`任务启动：${taskId}`);
  } catch (error) {
    state.status = "error";
    ElMessage.error(error.message || "启动任务失败");
    pushLog(`启动失败：${error.message || "unknown error"}`);
  }
}

async function cancelTask() {
  if (!state.taskId) return;
  const { cancelled } = await getApi().cancelTask(state.taskId);
  if (cancelled) {
    pushLog("任务已取消");
    state.status = "idle";
    state.progress = 0;
    state.taskId = "";
  }
}

function handleTaskEvent(event) {
  if (!state.taskId || event.taskId !== state.taskId) return;
  if (event.type === "log") {
    pushLog(`${event.level.toUpperCase()} ${event.message}`);
  } else if (event.type === "progress") {
    state.progress = event.progress;
    pushLog(`进度 ${event.progress}% - ${event.stage}`);
  } else if (event.type === "done") {
    state.status = "done";
    state.taskId = "";
    pushLog(`任务完成，输出 ${event.result.outputFiles.length} 个文件`);
    ElMessage.success("拆分完成");
  } else if (event.type === "error") {
    state.status = "error";
    state.taskId = "";
    pushLog(`任务失败：${event.error.code} ${event.error.message}`);
    if (event.error.details?.stack) {
      pushLog(`堆栈：${event.error.details.stack}`);
    }
    ElMessage.error(event.error.message);
  } else if (event.type === "cancelled") {
    state.status = "idle";
    state.taskId = "";
  }
}

onMounted(async () => {
  try {
    await loadRules();
    // 如果已加载过文件，验证 sheet 名称
    if (state.inputFile) {
      await validateSheetNames(state.inputFile);
    }
    unsubscribe = getApi().onTaskEvent(handleTaskEvent);
  } catch (error) {
    state.status = "error";
    ElMessage.error(error.message || "初始化失败");
    pushLog(`初始化失败：${error.message || "unknown error"}`);
  }
});

onUnmounted(() => {
  if (unsubscribe) unsubscribe();
});
</script>

<style scoped>
.drop-zone {
  width: 100%;
  border: 2px dashed transparent;
  border-radius: var(--el-border-radius-base);
  transition: all 0.2s ease;
}
.drop-zone--active {
  border-color: var(--el-color-primary);
  background: rgba(64, 158, 255, 0.05);
}
</style>
