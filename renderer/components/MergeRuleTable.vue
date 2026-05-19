<template>
  <el-table :data="rules" border>
    <el-table-column label="启用" width="70">
      <template #default="{ row }">
        <el-switch v-model="row.enabled" />
      </template>
    </el-table-column>

    <el-table-column label="源 Sheet" min-width="180">
      <template #default="{ row }">
        <el-select
          v-model="row.sheetName"
          placeholder="填写或选择 sheet"
          filterable
          allow-create
          clearable
          style="width: 100%"
          @change="onSheetNameChange(row)"
        >
          <el-option
            v-for="name in sourceSheetNames"
            :key="`src-${name}`"
            :label="name"
            :value="name"
          />
        </el-select>
      </template>
    </el-table-column>

    <el-table-column label="标题行数" width="105">
      <template #default="{ row }">
        <el-input-number v-model="row.headerRows" :min="1" :step="1" size="small" />
      </template>
    </el-table-column>

    <el-table-column label="供应商列" width="95">
      <template #default="{ row }">
        <el-input v-model="row.splitColumn" maxlength="3" />
      </template>
    </el-table-column>

    <el-table-column label="目标模板 Sheet" min-width="180">
      <template #default="{ row }">
        <el-select
          v-model="row.outputSheetName"
          placeholder="选择模板中的 sheet"
          filterable
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="name in templateSheetNames"
            :key="`tpl-${name}`"
            :label="name"
            :value="name"
          />
        </el-select>
      </template>
    </el-table-column>

    <el-table-column label="跳过空供应商" width="120">
      <template #default="{ row }">
        <el-switch v-model="row.skipEmpty" />
      </template>
    </el-table-column>

    <el-table-column label="Sheet 内排序" width="170">
      <template #default="{ row }">
        <div style="display: grid; grid-template-columns: 1fr 76px; gap: 6px">
          <el-input v-model="row.sortColumn" placeholder="列头名" />
          <el-select v-model="row.sortOrder" clearable placeholder="顺序">
            <el-option label="升序" value="asc" />
            <el-option label="降序" value="desc" />
          </el-select>
        </div>
      </template>
    </el-table-column>

    <el-table-column label="操作" width="130" fixed="right">
      <template #default="{ $index }">
        <el-button text type="primary" @click="$emit('select', $index)">列头映射</el-button>
        <el-button text type="danger" @click="$emit('remove', $index)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup>
const props = defineProps({
  rules: { type: Array, required: true },
  sourceSheetNames: { type: Array, default: () => [] },
  templateSheetNames: { type: Array, default: () => [] },
});

defineEmits(["remove", "select"]);

function onSheetNameChange(row) {
  if (!row.outputSheetName && props.templateSheetNames.includes(row.sheetName)) {
    row.outputSheetName = row.sheetName;
  }
}
</script>
