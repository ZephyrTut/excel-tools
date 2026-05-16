<template>
  <el-card class="panel-card">
    <template #header>
      <div>功能入口</div>
    </template>
    <el-row :gutter="12">
      <el-col :span="8">
        <el-card shadow="hover">
          <h3>Excel 拆分</h3>
          <p>按规则对多个 sheet 执行分组拆分并批量导出。</p>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <h3>合并汇总（预留）</h3>
          <p>后续支持多表合并、字段映射与去重汇总。</p>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <h3>对账分析（预留）</h3>
          <p>后续支持差异检测、对账规则与异常提示。</p>
        </el-card>
      </el-col>
    </el-row>
  </el-card>
</template>
