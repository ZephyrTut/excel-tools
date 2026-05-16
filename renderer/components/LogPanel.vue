<template>
  <el-card class="panel-card">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center">
        <span>运行日志</span>
        <el-button text @click="$emit('clear')">清空</el-button>
      </div>
    </template>
    <div
      style="
        max-height: 260px;
        overflow: auto;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 6px;
        padding: 8px;
        font-family: Consolas, monospace;
        font-size: 12px;
      "
    >
      <div v-for="(line, i) in lines" :key="i" style="padding: 2px 0">
        {{ line }}
      </div>
    </div>
  </el-card>
</template>

<script setup>
defineProps({
  lines: {
    type: Array,
    required: true
  }
});

defineEmits(["clear"]);
</script>
