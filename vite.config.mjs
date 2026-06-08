import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { fileURLToPath } from "node:url";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.join(configDir, "renderer"),
  base: "./",
  plugins: [
    vue(),
    // Tree-shake Element Plus components used by the renderer.
    AutoImport({
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
  build: {
    outDir: path.join(configDir, "dist", "renderer"),
    emptyOutDir: true,
    // Disable source maps in production to keep the renderer bundle small.
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the largest framework bundles into separate chunks.
        manualChunks: {
          "vendor-vue": ["vue"],
          "vendor-element-plus": ["element-plus"],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
