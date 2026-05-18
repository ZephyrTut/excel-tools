<template>
  <el-table :data="rules" border>
    <el-table-column label="启用" width="70">
      <template #default="{ row }">
        <el-switch v-model="row.enabled" />
      </template>
    </el-table-column>
    <el-table-column label="Sheet 名称" min-width="190">
      <template #default="{ row }">
        <el-select
          v-model="row.sheetName"
          :placeholder="sourcePlaceholder"
          filterable
          clearable
          style="width: 100%"
          @change="onSheetNameChange(row)"
        >
          <el-option
            v-for="name in sourceSheetNames"
            :key="name"
            :label="name"
            :value="name"
          />
        </el-select>
      </template>
    </el-table-column>
    <el-table-column label="标题行数" width="105">
      <template #default="{ row }">
        <el-input-number v-model="row.headerRows" :min="0" :step="1" size="small" />
      </template>
    </el-table-column>
    <el-table-column label="拆分列" width="85">
      <template #default="{ row }">
        <el-input v-model="row.splitColumn" maxlength="3" />
      </template>
    </el-table-column>
    <el-table-column label="输出 Sheet 名称" min-width="190">
      <template #default="{ row }">
        <el-select
          v-model="row.outputSheetName"
          :placeholder="templatePlaceholder"
          filterable
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="name in templateSheetNames"
            :key="name"
            :label="name"
            :value="name"
          />
        </el-select>
      </template>
    </el-table-column>
    <el-table-column label="跳过空值" width="90">
      <template #default="{ row }">
        <el-switch v-model="row.skipEmpty" />
      </template>
    </el-table-column>
    <el-table-column label="操作" width="80">
      <template #default="{ $index }">
        <el-button text type="danger" @click="$emit('remove', $index)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
const props = defineProps({
  rules: { type: Array, required: true },
  sourceSheetNames: { type: Array, default: () => [] },
  templateSheetNames: { type: Array, default: () => [] }
});

const emit = defineEmits(["remove", "update"]);

const sourcePlaceholder = props.sourceSheetNames.length
  ? "选择源文件中的 sheet"
  : "请先选择源文件";
const templatePlaceholder = props.templateSheetNames.length
  ? "选择模板中的 sheet"
  : "（未加载模板）";

/** When a source sheet is selected, auto-match output sheet name. */
function onSheetNameChange(row) {
  if (!row.outputSheetName && props.templateSheetNames.includes(row.sheetName)) {
    row.outputSheetName = row.sheetName;
  }
}
</script>
