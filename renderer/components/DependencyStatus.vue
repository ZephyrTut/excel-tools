<template>
  <div class="dependency-status" v-if="results.length > 0 || installing">
    <!-- 安装进度 -->
    <div v-if="installing" class="dep-installing">
      <el-progress :percentage="progressPercent" :stroke-width="10" style="margin-bottom: 4px" />
      <div class="dep-install-msg">{{ progressMessage }}</div>
    </div>

    <!-- 结果状态条（有失败时才显示，点击展开详情） -->
    <div v-if="!installing && hasIssues" class="dep-bar" :class="'dep-bar--' + overallStatus" @click="expanded = !expanded">
      <span class="dep-bar-icon">{{ overallIcon }}</span>
      <span class="dep-bar-text">{{ overallText }}</span>
      <span class="dep-bar-action">{{ expanded ? '收起 ▲' : '详情 ▼' }}</span>
    </div>

    <!-- 全部就绪时极简展示 -->

    <!-- 详情列表（仅失败项） -->
    <div v-if="expanded && !installing" class="dep-list">
      <div
        v-for="item in failedResults"
        :key="item.id"
        class="dep-item"
        :class="'dep-item--' + item.status"
      >
        <span class="dep-item-icon">{{ itemIcon(item) }}</span>
        <div class="dep-item-body">
          <div class="dep-item-head">
            <span class="dep-item-name">{{ item.name }}</span>
            <span v-if="item.autoFixApplied" class="dep-item-badge badge-fix">已自动修复</span>
            <span v-else-if="item.status === 'missing'" class="dep-item-badge badge-missing">缺失</span>
          </div>
          <div class="dep-item-desc">{{ item.description }}</div>
          <div class="dep-item-meta">影响：{{ item.requiredBy.join('、') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  results: { type: Array, default: () => [] },
  installing: { type: Boolean, default: false },
  progressPercent: { type: Number, default: 0 },
  progressMessage: { type: String, default: "" },
});

const expanded = ref(false);

const okCount = computed(() => props.results.filter((r) => r.status === "ok").length);
const totalCount = computed(() => props.results.length);
const hasIssues = computed(() => props.results.some(r => r.status === "missing" || r.status === "error"));
const failedResults = computed(() => props.results.filter(r => r.status !== "ok"));

const overallStatus = computed(() => {
  if (props.results.some((r) => r.status === "error")) return "error";
  if (props.results.some((r) => r.status === "missing")) return "warn";
  return "ok";
});

const overallIcon = computed(() => {
  if (overallStatus.value === "ok") return "✅";
  if (overallStatus.value === "error") return "❌";
  return "⚠️";
});

const overallText = computed(() => {
  if (overallStatus.value === "ok") return `所有依赖就绪 (${okCount.value}/${totalCount.value})`;
  return `${totalCount.value - okCount.value} 项依赖需处理`;
});

function itemIcon(item) {
  switch (item.status) {
    case "ok": return "✅";
    case "checking": return "⏳";
    case "fixing": return "🔧";
    case "missing": return "❌";
    case "error": return "⚠️";
    default: return "❓";
  }
}
</script>

<style scoped>
.dependency-status {
  margin-top: 8px;
  font-size: 13px;
}

.dep-installing {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: rgba(8, 145, 178, 0.04);
}

.dep-install-msg {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

.dep-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.dep-bar--ok {
  background: rgba(16, 185, 129, 0.06);
  color: var(--success);
}

.dep-bar--warn {
  background: rgba(245, 158, 11, 0.06);
  color: var(--warning);
}

.dep-bar--error {
  background: rgba(239, 68, 68, 0.06);
  color: var(--danger);
}

.dep-bar:hover {
  filter: brightness(0.97);
}

.dep-bar-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.dep-bar-text {
  flex: 1;
  font-weight: 500;
}

.dep-bar-action {
  font-size: 12px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.dep-list {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dep-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--bg-canvas);
}

.dep-item-icon {
  flex-shrink: 0;
  font-size: 14px;
  margin-top: 1px;
}

.dep-item-body {
  flex: 1;
  min-width: 0;
}

.dep-item-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.dep-item-name {
  font-weight: 600;
  color: var(--text-primary);
}

.dep-item-badge {
  font-size: 11px;
  padding: 0 5px;
  border-radius: 3px;
  line-height: 1.6;
}

.badge-fix {
  background: rgba(16, 185, 129, 0.1);
  color: var(--success);
}

.badge-missing {
  background: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}

.dep-item-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.dep-item-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
