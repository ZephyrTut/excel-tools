<template>
  <div class="merge-grid">
    <el-card class="panel-card">
      <template #header><div>合并汇总配置</div></template>
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
        <el-form-item label="排序依据 Sheet">
          <el-select v-model="state.orderSheetName" filterable style="width: 100%">
            <el-option v-for="name in state.templateSheetNames" :key="name" :label="name" :value="name" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序列">
          <el-input v-model="state.orderColumn" maxlength="3" style="width: 80px" />
        </el-form-item>
        <el-form-item label="任务状态">
          <el-tag :type="statusType">{{ state.status }}</el-tag>
          <el-progress style="margin-left: 12px; width: 240px" :percentage="state.progress" :stroke-width="14" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :disabled="!canRun" @click="startTask">开始合并</el-button>
          <el-button type="warning" :disabled="!state.taskId" @click="cancelTask">取消</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <LogPanel :lines="state.logs" @clear="state.logs = []" />
  </div>
</template>

<script setup>
import { computed, reactive, onMounted, onUnmounted } from "vue";
import LogPanel from "../components/LogPanel.vue";

const state = reactive({
  templateFile: "",
  inputDir: "",
  outputDir: "",
  taskId: "",
  status: "idle",
  progress: 0,
  logs: [],
  orderSheetName: "日报",
  orderColumn: "C",
  templateSheetNames: []
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

async function pickTemplate() {
  const result = await getApi().selectTemplateFile();
  if (!result) return;
  state.templateFile = result.path;
  try {
    state.templateSheetNames = await getApi().getSheetNames(result.path);
  } catch { state.templateSheetNames = []; }
}

async function pickInputDir() {
  const dir = await getApi().selectOutputDir();
  if (!dir) return;
  state.inputDir = dir;
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
    const { taskId } = await getApi().startMergeTask({
      inputDir: state.inputDir,
      outputDir: state.outputDir,
      rules: {
        templateFile: state.templateFile,
        merge: {
          orderSheetName: state.orderSheetName,
          orderColumn: state.orderColumn,
          inputDir: state.inputDir
        }
      }
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
  if (cancelled) { pushLog("任务已取消"); state.status = "idle"; state.taskId = ""; }
}

function handleEvent(event) {
  if (!state.taskId || event.taskId !== state.taskId) return;
  if (event.type === "log") pushLog(`${event.level.toUpperCase()} ${event.message}`);
  else if (event.type === "progress") { state.progress = event.progress; pushLog(`进度 ${event.progress}% - ${event.stage}`); }
  else if (event.type === "done") { state.status = "done"; state.taskId = ""; pushLog("合并完成"); ElMessage.success("合并完成"); }
  else if (event.type === "error") { state.status = "error"; state.taskId = ""; pushLog(`失败：${event.error.message}`); ElMessage.error(event.error.message); }
  else if (event.type === "cancelled") { state.status = "idle"; state.taskId = ""; }
}

onMounted(() => { unsubTask = getApi().onTaskEvent(handleEvent); });
onUnmounted(() => { if (unsubTask) unsubTask(); });
</script>
