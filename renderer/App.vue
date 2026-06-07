<template>
  <div class="app-shell">
    <!-- 顶部导航 -->
    <header class="app-header">
      <div class="app-header-inner">
        <div class="app-brand">
          <span class="brand-icon">▣</span>
          <span class="brand-name">Excel Tools</span>
          <span class="brand-version">v{{ version }}</span>
        </div>
        <nav class="app-nav">
          <button
            v-for="tab in tabs"
            :key="tab.name"
            :class="['nav-pill', { active: active === tab.name }]"
            @click="active = tab.name"
          >
            <span class="nav-pill-label">{{ tab.label }}</span>
          </button>
        </nav>
      </div>
    </header>

    <!-- 主内容 -->
    <main class="app-main">
      <div class="app-container">
        <KeepAlive>
          <component
            :is="currentView"
            :key="active"
            @navigate="active = $event"

          />
        </KeepAlive>
      </div>
    </main>

    <!-- 浮动更新通知 Snackbar -->
    <Transition name="snackbar">
      <div v-if="updateState.visible" class="snackbar" :class="'snackbar--' + updateState.type">
        <div class="snackbar-body">
          <template v-if="updateState.type === 'checking'">
            <el-icon class="is-loading" style="margin-right: 8px"><Refresh /></el-icon>
            正在检查更新…
          </template>
          <template v-else-if="updateState.type === 'update-available'">
            <el-icon style="margin-right: 8px; color: var(--warning)"><Warning /></el-icon>
            发现新版本 <strong>v{{ updateState.version }}</strong>
            <el-button size="small" type="primary" style="margin-left: 10px" @click="downloadUpdate">
              下载更新
            </el-button>
            <el-button size="small" @click="dismissUpdate">稍后</el-button>
          </template>
          <template v-else-if="updateState.type === 'download-progress'">
            <el-icon class="is-loading" style="margin-right: 8px"><Download /></el-icon>
            更新下载中
            <el-progress
              :percentage="updateState.percent"
              :stroke-width="6"
              :status="updateState.percent === 100 ? 'success' : undefined"
              style="width: 140px; margin: 0 10px"
            />
            {{ updateState.percent }}%
          </template>
          <template v-else-if="updateState.type === 'update-downloaded'">
            <el-icon style="margin-right: 8px; color: var(--success)"><SuccessFilled /></el-icon>
            更新已就绪
            <el-button size="small" type="primary" style="margin-left: 10px" @click="installUpdate">
              立即重启
            </el-button>
            <el-button size="small" @click="dismissUpdate">稍后</el-button>
          </template>
          <template v-else-if="updateState.type === 'error'">
            <el-icon style="margin-right: 8px; color: var(--danger)"><CircleClose /></el-icon>
            检查更新失败：{{ updateState.message }}
          </template>
        </div>
        <button
          v-if="updateState.dismissible"
          class="snackbar-close"
          @click="dismissUpdate"
        >✕</button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { version } from "../package.json";
import { Refresh, Warning, Download, SuccessFilled, CircleClose } from "@element-plus/icons-vue";
import HomeView from "./views/HomeView.vue";
import SplitView from "./views/SplitView.vue";
import MergeView from "./views/MergeView.vue";
import OptimizeView from "./views/OptimizeView.vue";
import SendView from "./views/SendView.vue";

const active = ref("home");

const tabs = [
  { name: "home",   label: "首页" },
  { name: "split",  label: "Excel 拆分" },
  { name: "merge",  label: "合并汇总" },
  { name: "optimize", label: "模板优化" },
  { name: "send",   label: "发送工具" },
];

const viewMap = {
  home: HomeView,
  split: SplitView,
  merge: MergeView,
  optimize: OptimizeView,
  send: SendView,
};

const currentView = computed(() => viewMap[active.value]);

// ─── 更新管理 ─────────────────────────────

const updateState = reactive({
  visible: false,
  dismissible: true,
  type: "",
  version: "",
  percent: 0,
  message: ""
});

let unsubUpdate = null;

function dismissUpdate() { updateState.visible = false; }
function downloadUpdate() { window.excelTools?.downloadUpdate(); }
function installUpdate() { window.excelTools?.installUpdate(); }

onMounted(() => {
  const api = window.excelTools;
  if (!api) return;
  unsubUpdate = api.onUpdateEvent((event) => {
    switch (event.type) {
      case "checking":
        updateState.visible = true;
        updateState.dismissible = false;
        updateState.type = "checking";
        break;
      case "update-available":
        updateState.visible = true;
        updateState.dismissible = false;
        updateState.type = "update-available";
        updateState.version = event.info?.version || "";
        break;
      case "update-not-available":
        updateState.visible = false;
        break;
      case "download-progress":
        updateState.visible = true;
        updateState.dismissible = false;
        updateState.type = "download-progress";
        updateState.percent = event.percent || 0;
        break;
      case "update-downloaded":
        updateState.visible = true;
        updateState.dismissible = false;
        updateState.type = "update-downloaded";
        updateState.version = event.info?.version || "";
        break;
      case "error":
        updateState.visible = true;
        updateState.dismissible = true;
        updateState.type = "error";
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
/* ---- 布局外壳 ---- */
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ---- 顶部导航 ---- */
.app-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-header);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-light);
}
.app-header-inner {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
  height: 60px;
  display: flex;
  align-items: center;
  gap: 32px;
}

/* 品牌区 */
.app-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.brand-icon {
  font-size: 22px;
  color: var(--primary);
  line-height: 1;
}
.brand-name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}
.brand-version {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  line-height: 1.4;
}

/* 导航药丸 */
.app-nav {
  display: flex;
  gap: 4px;
}
.nav-pill {
  display: inline-flex;
  align-items: center;
  padding: 7px 18px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}
.nav-pill:hover {
  color: var(--text-primary);
  background: var(--primary-bg);
}
.nav-pill.active {
  color: #ffffff;
  background: var(--primary);
  font-weight: 600;
}

/* ---- 主内容 ---- */
.app-main {
  flex: 1;
  padding: 24px 0 48px;
  position: relative;
}
.app-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 24px;
}

/* ---- 浮动 Snackbar ---- */
.snackbar {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-size: 13px;
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  max-width: 560px;
}
.snackbar-body {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 4px;
}
.snackbar-close {
  background: none;
  border: none;
  font-size: 14px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s;
  padding: 4px;
  line-height: 1;
}
.snackbar-close:hover { opacity: 1; }

.snackbar--checking,
.snackbar--update-available,
.snackbar--download-progress {
  background: rgba(255, 255, 255, 0.95);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.snackbar--update-downloaded {
  background: rgba(240, 253, 244, 0.95);
  color: #166534;
  border: 1px solid #bbf7d0;
}
.snackbar--error {
  background: rgba(254, 242, 242, 0.95);
  color: #991b1b;
  border: 1px solid #fecaca;
}

.snackbar-enter-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.snackbar-leave-active {
  transition: all 0.25s ease;
}
.snackbar-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}
.snackbar-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}


</style>
