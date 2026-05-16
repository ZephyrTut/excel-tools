<template>
  <el-table :data="rules" border>
    <el-table-column label="启用" width="80">
      <template #default="{ row }">
        <el-switch v-model="row.enabled" />
      </template>
    </el-table-column>
    <el-table-column label="Sheet 名称" min-width="180">
      <template #default="{ row }">
        <el-input v-model="row.sheetName" />
      </template>
    </el-table-column>
    <el-table-column label="标题行数" width="110">
      <template #default="{ row }">
        <el-input-number v-model="row.headerRows" :min="0" :step="1" />
      </template>
    </el-table-column>
    <el-table-column label="拆分列" width="100">
      <template #default="{ row }">
        <el-input v-model="row.splitColumn" maxlength="3" />
      </template>
    </el-table-column>
    <el-table-column label="输出 Sheet 名称" min-width="180">
      <template #default="{ row }">
        <el-input v-model="row.outputSheetName" />
      </template>
    </el-table-column>
    <el-table-column label="跳过空值" width="100">
      <template #default="{ row }">
        <el-switch v-model="row.skipEmpty" />
      </template>
    </el-table-column>
    <el-table-column label="操作" width="90">
      <template #default="{ $index }">
        <el-button text type="danger" @click="$emit('remove', $index)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
defineProps({
  rules: {
    type: Array,
    required: true
  }
});

defineEmits(["remove"]);
</script>
