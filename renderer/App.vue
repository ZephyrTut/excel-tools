<template>
  <el-container>
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
      </el-tabs>
    </el-main>
  </el-container>
</template>

<script setup>
import { ref } from "vue";
import HomeView from "./views/HomeView.vue";
import SplitView from "./views/SplitView.vue";

const active = ref("split");
</script>
