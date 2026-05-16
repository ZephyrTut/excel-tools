---
name: find-skill
description: "Find and diagnose Electron + Vite DevTools issues. Use when console errors appear in development, when npm run dev starts but app behavior is broken, or when you need a repeatable DevTools debugging flow."
---

# Find Skill (DevTools Debugging)

用于快速定位 **Electron + Vite** 开发环境中的 DevTools 问题，尤其是控制台报错、资源加载失败、IPC 调用异常、预加载桥接问题。

## When to Use

- `npm run dev` 已启动，但页面空白或功能异常
- DevTools Console 出现报错，需要快速定位根因
- 需要检查 Renderer / Main / Preload 的调用链
- 需要形成可复用的“复现 -> 定位 -> 修复 -> 回归”调试流程

## Procedure

1. **收集最小复现信息**
   - 记录报错全文（包含 stack、文件路径、行号）
   - 记录触发动作（如“点击开始拆分”）
   - 标记错误来源：Renderer / Preload / Main

2. **先做错误分层**
   - `ReferenceError / TypeError`：优先检查变量、返回值、对象结构
   - `Failed to load resource`：检查 Vite 资源路径和 `loadURL/loadFile` 分支
   - `ipcRenderer.invoke` 失败：检查 `preload.js` 暴露 API 与 `ipcMain.handle` 名称是否一致
   - `contextBridge` 相关：检查 `contextIsolation`、`nodeIntegration` 配置与桥接对象名称

3. **按调用链定位**
   - Renderer 触发点（组件方法）
   - Preload 暴露接口（`window.xxx`）
   - Main IPC handler（`ipcMain.handle`）
   - Service/Engine 业务函数（实际报错处）

4. **做最小修复**
   - 只改导致当前报错的必要代码
   - 保持接口签名与现有模块边界不变
   - 修复后重复触发同一路径验证报错消失

5. **回归检查**
   - 再次执行触发路径，确认无新增控制台报错
   - 核对任务关键状态：启动、进度、完成/失败日志是否正常

## Fast Checklist

- `window.excelTools` 是否存在且方法齐全
- IPC 通道名是否前后完全一致
- 生产/开发路径分支是否正确
- 规则数据是否满足最小必填字段
- 报错是否已从 Console 与日志面板同时消失

## Output Format (建议)

调试结论输出时按以下结构：

1. 报错现象（原始错误 + 触发动作）
2. 根因定位（具体到文件与函数）
3. 修复内容（最小改动点）
4. 回归结果（同路径复测结果）
