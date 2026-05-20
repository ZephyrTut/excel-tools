<template>
  <el-card class="panel-card">
    <template #header>
      <div class="log-header">
        <span>运行日志</span>
        <el-button text size="small" @click="$emit('clear')">清空</el-button>
      </div>
    </template>
    <div class="log-console" ref="consoleRef">
      <div v-for="(line, i) in lines" :key="i" class="log-line" :class="{ 'log-line--new': i === lines.length - 1 }">
        <span class="log-marker">›</span>
        {{ line }}
      </div>
    </div>
  </el-card>
</template>

<script setup>
import { ref, watch, nextTick } from "vue";

const props = defineProps({
  lines: {
    type: Array,
    required: true
  }
});

defineEmits(["clear"]);

const consoleRef = ref(null);

watch(() => props.lines.length, async () => {
  await nextTick();
  if (consoleRef.value) {
    consoleRef.value.scrollTop = consoleRef.value.scrollHeight;
  }
});
</script>

<style scoped>
.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.log-console {
  max-height: 260px;
  overflow-y: auto;
  background: linear-gradient(135deg, #0c1929 0%, #112240 100%);
  color: #ccd6f6;
  border-radius: var(--radius-sm);
  padding: 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.7;
  border: 1px solid rgba(8, 145, 178, 0.15);
}
.log-line {
  padding: 1px 0;
  opacity: 0.9;
  display: flex;
  gap: 6px;
}
.log-line:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.03);
}
.log-marker {
  color: var(--primary-light);
  opacity: 0.5;
  user-select: none;
}
.log-line--new {
  animation: logFadeIn 0.3s ease;
}
@keyframes logFadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 0.9;
    transform: translateY(0);
  }
}
</style>
