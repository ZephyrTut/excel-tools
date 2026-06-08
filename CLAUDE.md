# Excel Tools — 代码库导航

Electron 31 + Vue 3 + Element Plus + ExcelJS 桌面应用，pnpm 管理依赖。

> ⚠️ **硬性规则：每次处理任务前，必须先调用 `using-superpowers` skill，再根据任务类型调用对应的 superpowers 相关 skill（如 `systematic-debugging` 修 Bug、`brainstorming` 设计方案等），然后才能开始编码。** 即使只有 1% 的可能性某个 skill 适用，也必须调用检查。

## 快速命令

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 启动 Vite dev server + Electron |
| `pnpm build` | 打包为 Windows 安装包 |
| `pnpm start` | 生产模式启动 |
| `pnpm test` | 运行测试 (vitest) |
| `pnpm release` | 发布新版本 (patch/minor/major) |

## Feature → File 映射

### 三大核心功能

| 功能 | 前端 View | 后端 Service | IPC 入口 | 执行模式 |
|------|-----------|-------------|----------|---------|
| **Excel 拆分** | [SplitView.vue](renderer/views/SplitView.vue) | [split/](services/split/) | `task:start-split` | Worker 线程 |
| **合并汇总** | [MergeView.vue](renderer/views/MergeView.vue) | [merge/](services/merge/) | `task:start-merge` | Worker 线程 |
| **模板优化** | [OptimizeView.vue](renderer/views/OptimizeView.vue) | [optimize/](services/optimize/) | `optimize:run` | 主进程 |

### 辅助功能

| 功能 | 文件 | IPC 入口 |
|------|------|---------|
| 自动更新 | [updater.js](main/updater.js) | `update:{check,download,install}` |
| 国内更新镜像 | [阿里云 OSS](https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/) + [Gitee](https://gitee.com/ZephyrTut/excel-tools) | 国内用户免 VPN 更新 |
| 规则管理 | [ruleManager.js](services/split/ruleManager.js) | `rules:{load,save,get-defaults}` |
| 模板管理 | [ipc.js](main/ipc.js) (template:* handlers) | `template:{list,import,delete}` |

## IPC 桥接速查

数据流：**Renderer** → `window.excelTools.xxx()` → [preload.js](main/preload.js) (contextBridge) → [ipc.js](main/ipc.js) (ipcMain.handle) → Service

| Renderer API | preload 方法 | IPC Channel | ipc.js 行号 |
|---|---|---|---|
| `selectInputFile()` | `dialog:select-input-file` | dialog* | 87 |
| `selectTemplateFile()` | `dialog:select-template-file` | dialog* | 104 |
| `selectOutputDir()` | `dialog:select-output-dir` | dialog* | 121 |
| `selectOptimizeFile()` | `dialog:select-optimize-file` | dialog* | 442 |
| `getSheetNames(filePath)` | `file:get-sheet-names` | file:* | 160 |
| `loadRules()` | `rules:load` | rules:* | 130 |
| `saveRules(rules)` | `rules:save` | rules:* | 142 |
| `getDefaultRules()` | `rules:get-defaults` | rules:* | 148 |
| `startSplitTask(payload)` | `task:start-split` | task:* | 250 |
| `startMergeTask(payload)` | `task:start-merge` | task:* | 261 |
| `cancelTask(taskId)` | `task:cancel` | task:* | 272 |
| `preloadMergeHeaders(payload)` | `merge:preload-headers` | merge:* | 279 |
| `listTemplates()` | `template:list` | template:* | 182 |
| `importTemplate(sourcePath)` | `template:import` | template:* | 221 |
| `deleteTemplate(name)` | `template:delete` | template:* | 241 |
| `runOptimize(filePath)` | `optimize:run` | optimize:* | 454 |
| `saveOptimizedFile(tempPath)` | `optimize:save` | optimize:* | 495 |
| `checkForUpdates()` / `downloadUpdate()` / `installUpdate()` | `update:*` | update:* | 428-437 |
| `onTaskEvent(handler)` | `task:event` (push) | ipcRenderer.on | 21-24 |
| `onUpdateEvent(handler)` | `update:event` (push) | ipcRenderer.on | 29-32 |

## 核心函数定位

### split/ — Excel 拆分

| 文件 | 关键函数 | 行号 | 职责 |
|------|---------|------|------|
| [splitService.js](services/split/splitService.js) | `runSplitTask()` | 23 | 拆分入口、校验、生命周期 |
| [splitEngine.js](services/split/splitEngine.js) | `runSplitEngine()` | 309 | 核心编排：分组 -> 写出 |
| [splitEngine.js](services/split/splitEngine.js) | `collectRowsByKey()` | 241 | 按拆分键分组 |
| [splitEngine.js](services/split/splitEngine.js) | `buildOutputWorkbookForKey()` | 273 | 构建单个输出工作簿 |
| [splitEngine.js](services/split/splitEngine.js) | `buildRuleContexts()` | 86 | 规则上下文构建 |
| [splitEngine.js](services/split/splitEngine.js) | `buildRuleContextsWithTemplate()` | 90 | 带模板的规则上下文 |
| [excelReader.js](services/split/excelReader.js) | `readWorkbook()` | 3 | 读取 Excel 文件 |
| [excelReader.js](services/split/excelReader.js) | `getSheetHeaders()` | 42 | 读取列头 |
| [excelReader.js](services/split/excelReader.js) | `getHeadersFromWorksheet()` | 76 | 从 worksheet 提取列头 |
| [excelWriter.js](services/split/excelWriter.js) | `writeSplitOutputs()` | 24 | 写出拆分结果 |
| [styleCopier.js](services/split/styleCopier.js) | `copyWorksheetMeta()` | 12 | 复制工作表元数据 |
| [styleCopier.js](services/split/styleCopier.js) | `copyRowAndCells()` | 135 | 复制行与单元格 |
| [styleCopier.js](services/split/styleCopier.js) | `copyHeaderRowsWithMerges()` | 306 | 复制标题行+合并单元格 |
| [ruleManager.js](services/split/ruleManager.js) | `loadRules()` | 48 | 加载规则（默认+用户） |
| [pathUtil.js](services/split/pathUtil.js) | `sanitizeWindowsFileName()` | 6 | 文件名清洗 |
| [errors.js](services/split/errors.js) | — | — | AppError、ErrorCodes |

### merge/ — 合并汇总

| 文件 | 关键函数 | 行号 | 职责 |
|------|---------|------|------|
| [mergeService.js](services/merge/mergeService.js) | `runMergeTask()` | 70 | 合并入口、校验、生命周期 |
| [mergeService.js](services/merge/mergeService.js) | `resolveRules()` | 12 | 规则解析与合并 |
| [mergeService.js](services/merge/mergeService.js) | `listSourceFiles()` | 42 | 扫描源文件 |
| [mergeEngine.js](services/merge/mergeEngine.js) | `runMergeEngine()` | 344 | 核心编排引擎 |
| [mergeEngine.js](services/merge/mergeEngine.js) | `writeMergedSheet()` | 275 | 写出合并后的 sheet |
| [mergeEngine.js](services/merge/mergeEngine.js) | `collectSheetRowsByVendor()` | 172 | 按供应商收集数据行 |
| [mergeEngine.js](services/merge/mergeEngine.js) | `resolveHeaderMap()` | 85 | 列头智能映射 |
| [mergeEngine.js](services/merge/mergeEngine.js) | `mapSourceToTargetColumns()` | 133 | 源->目标列匹配 |
| [mergeEngine.js](services/merge/mergeEngine.js) | `buildOrderList()` | 148 | 排序列表构建 |
| [mergeEngine.js](services/merge/mergeEngine.js) | `orderedVendorsForSheet()` | 230 | 供应商排序 |
| [mergeEngine.js](services/merge/mergeEngine.js) | `createPassthroughSheet()` | 270 | 透传 sheet |
| [mergeEngine.js](services/merge/mergeEngine.js) | `copyColumnWidths()` | 258 | 复制列宽 |

### optimize/ — 模板优化

| 文件 | 关键函数 | 行号 | 职责 |
|------|---------|------|------|
| [templateOptimizer.js](services/optimize/templateOptimizer.js) | `optimizeTemplate()` | 185 | 优化入口：ZIP级别清理 |
| [templateOptimizer.js](services/optimize/templateOptimizer.js) | `optimizeWorksheetXml()` | 48 | 清理空单元格/空行/维度 |
| [templateOptimizer.js](services/optimize/templateOptimizer.js) | `shouldRemovePath()` | 162 | 判断是否移除文件 |
| [zipUtils.js](services/optimize/zipUtils.js) | `readXlsxEntries()` | 11 | 读取 XLSX 条目 |
| [zipUtils.js](services/optimize/zipUtils.js) | `writeXlsxFile()` | 34 | 写出优化后的 XLSX |

### renderer/ — 前端组件

| 文件 | 关键函数/区域 | 行号 |
|------|-------------|------|
| [App.vue](renderer/App.vue) | Tabs 导航 + 更新通知栏 | 1-190 |
| [SplitView.vue](renderer/views/SplitView.vue) | `startSplit()` / `cancelTask()` | 549 行 |
| [MergeView.vue](renderer/views/MergeView.vue) | 模板选择、列映射面板 | 485 行 |
| [OptimizeView.vue](renderer/views/OptimizeView.vue) | `runOptimize()` / `saveFile()` | 218 行 |
| [HomeView.vue](renderer/views/HomeView.vue) | 首页 + 版本更新检测 | 27 行 |
| [MergeColumnMappingPanel.vue](renderer/components/MergeColumnMappingPanel.vue) | 列拖拽映射 UI | 650 行 |
| [RuleTable.vue](renderer/components/RuleTable.vue) | 拆分规则表格 | 90 行 |
| [LogPanel.vue](renderer/components/LogPanel.vue) | 任务日志面板 | 37 行 |

### main/ — 主进程

| 文件 | 关键函数/区域 | 行号 |
|------|-------------|------|
| [main.js](main/main.js) | `app.whenReady()` 入口 | 60 行 |
| [ipc.js](main/ipc.js) | `registerIpcHandlers()` — 所有 IPC | 509 行 |
| [preload.js](main/preload.js) | contextBridge 暴露 22 个 API | 36 行 |
| [window.js](main/window.js) | BrowserWindow 创建 | 32 行 |
| [workerRunner.js](main/workerRunner.js) | Worker 线程管理 | 80 行 |
| [taskWorker.js](main/taskWorker.js) | Worker 任务处理 | 45 行 |
| [updater.js](main/updater.js) | 自动更新（OSS 镜像 → GitHub 回退） | 63 行 |

## 数据流架构

```
Renderer (Vue)
  ↓ window.excelTools.xxx()
preload.js (contextBridge)
  ↓ ipcRenderer.invoke()
ipc.js (ipcMain.handle)
  ├──→ Worker 线程 (split/merge 重型任务)
  │     任务状态通过 task:event 推回 Renderer
  └──→ 主进程直接调用 (optimize/update 轻型任务)
```

## 编码规范

| 规范 | 规则 |
|------|------|
| 模块系统 | CommonJS (`require` / `module.exports`) |
| 服务文件 | kebab-case (`splitEngine.js`) |
| Vue 组件 | PascalCase (`SplitView.vue`) |
| 包管理 | pnpm（禁用 npm） |
| 样式范式 | 函数式（工厂函数、纯对象），避免 class |
| 任务隔离 | 重型 Excel 操作在 Worker 线程执行 |
| Worker 内存 | 默认 3072MB，环境变量 `SPLIT_WORKER_MEMORY_MB` 可调 |

## 新功能接入 Checklist

1. 在 `services/<feature>/` 下创建业务逻辑模块
2. 在 `main/ipc.js` 的 `registerIpcHandlers()` 中添加 `ipcMain.handle` 
3. 在 `main/preload.js` 的 `api` 对象中添加 contextBridge 暴露
4. 在 `renderer/App.vue` 中添加 `<el-tab-pane>` 引入新 View

> 重型任务（Excel 读写）走 Worker 线程 + `task:event` 回传进度；
> 轻型任务（文件操作、优化）在主进程直接执行。

## 文档索引

| 文档 | 内容 |
|------|------|
| [PRD.md](docs/PRD.md) | 产品需求与 MVP 范围 |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | 技术架构与分层设计 |
| [DECISIONS.md](docs/DECISIONS.md) | 关键技术决策 |
| [SPLIT_LOGIC.md](docs/SPLIT_LOGIC.md) | 拆分引擎实现细节 |
| [MERGE_LOGIC.md](docs/MERGE_LOGIC.md) | 合并引擎实现细节 |
| [XLSX_OPTIMIZATION_GUIDE.md](docs/XLSX_OPTIMIZATION_GUIDE.md) | XLSX 优化指南 |
| [PROMPTS.md](docs/PROMPTS.md) | AI 协作提示词模板 |
| [BUILD.md](docs/BUILD.md) | 构建与发布流程 |
