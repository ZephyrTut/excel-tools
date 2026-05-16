---
mode: ask
description: "DevTools console error triage for Electron + Vite. Use when npm run dev is up and console reports errors."
---

# Find Skill Prompt (DevTools)

按以下流程处理控制台报错：

1. 先要求用户提供完整错误（message + stack + 文件行号 + 触发动作）。
2. 判断错误层级：Renderer / Preload / Main / Service。
3. 沿调用链定位：组件事件 -> `window.excelTools` -> `ipcMain.handle` -> 业务函数。
4. 给出最小修复补丁（只改与报错直接相关代码）。
5. 输出回归步骤，要求同一路径复测并确认控制台无新增报错。

输出格式固定：

1. 现象  
2. 根因  
3. 修复点  
4. 复测结果
