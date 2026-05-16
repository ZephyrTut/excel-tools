import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  root: path.resolve(process.cwd(), "renderer"),
  plugins: [vue()],
  build: {
    outDir: path.resolve(process.cwd(), "dist", "renderer"),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
