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
          <el-input v-model="state.inputFile" placeholder="请选择 xlsx 文件" readonly>
            <template #append>
              <el-button @click="pickInputFile">选择</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item v-if="state.fileInfo.name" label="文件信息">
          <el-text>
            {{ state.fileInfo.name }}（{{ formatFileSize(state.fileInfo.size) }}）
          </el-text>
        </el-form-item>
        <el-form-item label="输出目录">
          <el-input v-model="state.outputDir" placeholder="请选择输出目录" readonly>
            <template #append>
              <el-button @click="pickOutputDir">选择</el-button>
            </template>
          </el-input>
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
      <RuleTable :rules="state.rules.sheetRules" @remove="removeRule" />
    </el-card>

    <LogPanel :lines="state.logs" @clear="state.logs = []" />

    <el-dialog v-model="state.showTemplateDialog" title="模板文件设置" width="520px" append-to-body>
      <el-form label-width="100px">
        <el-form-item label="模板路径">
          <el-input v-model="state.dialogTemplatePath" placeholder="未设置模板，使用源文件样式" readonly />
        </el-form-item>
      </el-form>
      <p style="font-size: 13px; color: #888; margin: 0 0 0 100px;">
        模板用于提供列宽、字体、底色等样式参考。不设置则从源文件获取样式。
      </p>
      <template #footer>
        <el-space wrap>
          <el-button @click="dialogPickTemplate">📂 选择模板</el-button>
          <el-button @click="dialogClearTemplate">清空</el-button>
          <el-button @click="dialogResetDefault">恢复默认</el-button>
          <el-button type="primary" @click="dialogConfirm">确定</el-button>
          <el-button @click="state.showTemplateDialog = false">取消</el-button>
        </el-space>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive } from "vue";
import { ElMessage } from "element-plus";
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
  defaultTemplateFile: "",
  showTemplateDialog: false,
  dialogTemplatePath: "",
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
  }
});

let unsubscribe = null;
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

async function pickInputFile() {
  const result = await getApi().selectInputFile();
  if (!result) return;
  state.inputFile = result.path;
  state.fileInfo.name = result.name;
  state.fileInfo.size = result.size || 0;
}

async function pickOutputDir() {
  const dir = await getApi().selectOutputDir();
  if (!dir) return;
  state.outputDir = dir;
}

function openTemplateDialog() {
  state.dialogTemplatePath = state.rules.templateFile || "";
  state.showTemplateDialog = true;
}

async function dialogPickTemplate() {
  const result = await getApi().selectTemplateFile();
  if (!result) return;
  state.dialogTemplatePath = result.path;
}

function dialogClearTemplate() {
  state.dialogTemplatePath = "";
}

function dialogResetDefault() {
  state.dialogTemplatePath = state.defaultTemplateFile || "";
}

function dialogConfirm() {
  state.rules.templateFile = state.dialogTemplatePath;
  state.showTemplateDialog = false;
}

async function loadRules() {
  const rules = await getApi().loadRules();
  state.rules = rules;
  if (!state.outputDir && rules.defaultOutputDir) {
    state.outputDir = rules.defaultOutputDir;
  }
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
    const defaults = await getApi().getDefaultRules();
    state.defaultTemplateFile = defaults.templateFile || "";
    // 如果当前没设模板，用默认模板
    if (!state.rules.templateFile && defaults.templateFile) {
      state.rules.templateFile = defaults.templateFile;
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
