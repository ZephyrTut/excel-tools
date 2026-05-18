<template>
  <el-container style="min-height: 100vh">
    <el-header style="background: #1f2937; color: #fff">
      <div style="font-size: 18px; font-weight: 600; line-height: 60px">Excel Tools</div>
    </el-header>
    <el-main class="page-container">
      <el-tabs v-model="active">
        <el-tab-pane label="首页" name="home">
          <HomeView />
        </el-tab-pane>
        <el-tab-pane label="Excel 拆分" name="split">
          <SplitView />
        </el-tab-pane>
        <el-tab-pane label="合并汇总" name="merge">
          <MergeView />
        </el-tab-pane>
        <el-tab-pane label="合并汇总" name="merge">
          <MergeView />
        </el-tab-pane>
      </el-tabs>
    </el-main>

    <!-- Update notification bar -->
    <div v-if="updateState.visible" class="update-bar" :class="updateState.barClass">
      <div class="update-bar-body">
        <template v-if="updateState.type === 'checking'">
          <el-icon class="is-loading" style="margin-right: 8px"><Refresh /></el-icon>
          正在检查更新…
        </template>
        <template v-else-if="updateState.type === 'update-available'">
          <el-icon style="margin-right: 8px; color: #e6a23c"><Warning /></el-icon>
          发现新版本 <strong>v{{ updateState.version }}</strong>
          <el-button size="small" type="primary" style="margin-left: 12px" @click="downloadUpdate">
            下载更新
          </el-button>
          <el-button size="small" @click="dismissUpdate">稍后</el-button>
        </template>
        <template v-else-if="updateState.type === 'download-progress'">
          <el-icon class="is-loading" style="margin-right: 8px"><Download /></el-icon>
          更新下载中
          <el-progress
            :percentage="updateState.percent"
            :stroke-width="8"
            :status="updateState.percent === 100 ? 'success' : undefined"
            style="width: 180px; margin: 0 12px"
          />
          {{ updateState.percent }}%
        </template>
        <template v-else-if="updateState.type === 'update-downloaded'">
          <el-icon style="margin-right: 8px; color: #67c23a"><SuccessFilled /></el-icon>
          更新已就绪
          <el-button size="small" type="primary" style="margin-left: 12px" @click="installUpdate">
            立即重启
          </el-button>
          <el-button size="small" @click="dismissUpdate">稍后</el-button>
        </template>
        <template v-else-if="updateState.type === 'error'">
          <el-icon style="margin-right: 8px; color: #f56c6c"><CircleClose /></el-icon>
          检查更新失败：{{ updateState.message }}
        </template>
      </div>
      <el-button
        v-if="updateState.dismissible"
        text
        size="small"
        style="color: inherit; margin-left: auto"
        @click="dismissUpdate"
      >
        ✕
      </el-button>
    </div>
  </el-container>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from "vue";
import { Refresh, Warning, Download, SuccessFilled, CircleClose } from "@element-plus/icons-vue";
import HomeView from "./views/HomeView.vue";
import SplitView from "./views/SplitView.vue";
import MergeView from "./views/MergeView.vue";

const active = ref("split");

const updateState = reactive({
  visible: false,
  dismissible: true,
  type: "",
  barClass: "",
  version: "",
  percent: 0,
  message: ""
});

let unsubUpdate = null;

function dismissUpdate() {
  updateState.visible = false;
}

function downloadUpdate() {
  window.excelTools.downloadUpdate();
}

function installUpdate() {
  window.excelTools.installUpdate();
}

onMounted(() => {
  const api = window.excelTools;
  if (!api) return;
  unsubUpdate = api.onUpdateEvent((event) => {
    switch (event.type) {
      case "checking":
        updateState.visible = true;
        updateState.dismissible = false;
        updateState.type = "checking";
        updateState.barClass = "update-bar-info";
        break;
      case "update-available":
        updateState.visible = true;
        updateState.dismissible = false;
        updateState.type = "update-available";
        updateState.barClass = "update-bar-info";
        updateState.version = event.info?.version || "";
        break;
      case "update-not-available":
        updateState.visible = false;
        break;
      case "download-progress":
        updateState.visible = true;
        updateState.dismissible = false;
        updateState.type = "download-progress";
        updateState.barClass = "update-bar-info";
        updateState.percent = event.percent || 0;
        break;
      case "update-downloaded":
        updateState.visible = true;
        updateState.dismissible = false;
        updateState.type = "update-downloaded";
        updateState.barClass = "update-bar-ready";
        updateState.version = event.info?.version || "";
        break;
      case "error":
        updateState.visible = true;
        updateState.dismissible = true;
        updateState.type = "error";
        updateState.barClass = "update-bar-error";
        updateState.message = event.message || "";
        break;
    }
  });
});

onUnmounted(() => {
  if (unsubUpdate) unsubUpdate();
});
</script>

<style scoped>
.update-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  padding: 8px 20px;
  font-size: 13px;
  z-index: 9999;
  border-top: 1px solid rgba(0,0,0,0.08);
}
.update-bar-body {
  display: flex;
  align-items: center;
  flex: 1;
}
.update-bar-info {
  background: #e6f7ff;
  color: #333;
}
.update-bar-ready {
  background: #f0f9eb;
  color: #333;
}
.update-bar-error {
  background: #fef0f0;
  color: #333;
}
</style>
