import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    conditions: ["node", "require"],
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.{js,mjs}", "services/**/*.test.{js,mjs}"],
    server: {
      deps: {
        // exceljs 是 CJS/ESM 混合包，inline 确保 Vitest 正确处理
        inline: ["exceljs", "element-plus"],
      },
    },
    // 抑制 Element Plus 未注册组件的 Vue warnings（shallowMount 场景下正常）
    onConsoleLog(log) {
      if (log.includes("Failed to resolve component: el-")) return false;
      return undefined;
    },
  },
});
