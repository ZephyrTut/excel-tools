import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  root: path.resolve(process.cwd(), "renderer"),
  base: "./",
  plugins: [
    vue(),
    // Element Plus 按需引入（tree-shaking，只打包用到的组件）
    AutoImport({
      resolvers: [ElementPlusResolver()]
    }),
    Components({
      resolvers: [ElementPlusResolver()]
    })
  ],
  build: {
    outDir: path.resolve(process.cwd(), "dist", "renderer"),
    emptyOutDir: true,
    // 生产构建关闭 source map，减小体积
    sourcemap: false,
    rollupOptions: {
      output: {
        // 代码分割：将 Vue、Element Plus 等 vendor 拆到独立 chunk
        manualChunks: {
          "vendor-vue": ["vue"],
          "vendor-element-plus": ["element-plus"],
          "vendor-exceljs": ["exceljs"]
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
