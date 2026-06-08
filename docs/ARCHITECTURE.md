# 技术架构与模块设计

## 1. 项目定位

这是一个基于 Electron 的桌面 Excel 处理工具，当前核心能力分为三块：

- 拆分：按 `splitSheetRules` 将一个工作簿拆成多个输出文件。
- 合并：按 `mergeSheetRules` 和模板，将多个来源文件汇总成一个工作簿。
- 优化：对 xlsx 做 ZIP/XML 级清理，提升 Office 兼容性。

技术栈：

- Electron
- Vue 3 + Element Plus
- ExcelJS
- `adm-zip`

## 2. 分层结构

### Renderer

目录：

- `renderer/views/`
- `renderer/components/`

职责：

- 页面交互
- 规则编辑
- 模板选择
- 日志和进度展示
- 调用 `window.excelTools.*`

### Main

目录：

- `main/main.js`
- `main/window.js`
- `main/preload.js`
- `main/ipc.js`
- `main/workerRunner.js`
- `main/taskWorker.js`

职责：

- 创建 Electron 窗口
- 暴露 preload 桥接
- 注册 IPC
- 启动和管理 Worker
- 管理模板、规则、更新、文件选择

### Services

目录：

- `services/split/`
- `services/merge/`
- `services/optimize/`

职责：

- 承接主业务逻辑
- 拆分和合并的请求校验、规则归一化、编排执行
- Office 兼容修复和 ZIP/XML 后处理

## 3. 实际运行链路

```text
Renderer
  -> window.excelTools.*
  -> main/preload.js
  -> main/ipc.js
  -> service
  -> Worker 或主进程直调
```

### 重任务

以下任务走 Worker：

- `task:start-split`
- `task:start-merge`

对应文件：

- `main/workerRunner.js`
- `main/taskWorker.js`

### 轻任务

以下任务通常由主进程直接处理：

- `merge:preload-headers`
- `rules:*`
- `template:*`
- `optimize:*`
- `dialog:*`

### 自动更新

更新逻辑位于 [main/updater.js](./main/updater.js)，采用双源回退策略：

```text
checkForUpdates()
  ├── ① 阿里云 OSS（generic provider）
  │    └─ https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/latest.yml
  │       ├── 成功 → 返回更新信息
  │       └── 失败 → ② GitHub（github provider）
  │                  └─ https://github.com/ZephyrTut/excel-tools/releases
  │                     ├── 成功 → 返回更新信息
  │                     └── 失败 → 抛出错误
```

国内用户无需 VPN 即可通过 OSS 镜像检查更新。构建产物在 [release.yml](.github/workflows/release.yml) 中由 `ossutil` 自动同步到 OSS。

## 4. 关键入口

### 应用入口

- `main/main.js`

### 窗口与 preload

- `main/window.js`
- `main/preload.js`

`preload.js` 通过 `contextBridge.exposeInMainWorld("excelTools", api)` 暴露桌面桥接。

### IPC 中枢

- `main/ipc.js`

排查“按钮点下去后到底执行了什么”时，优先从这里开始。

## 5. 当前规则模型

当前真实生效的字段名如下：

- `split.templateFile`
- `merge.templateFile`
- `split.sheetNameAliases`
- `merge.sheetNameAliases`
- `splitSheetRules`
- `mergeSheetRules`

默认规则模板：

- `config/defaultRules.json`

规则加载与持久化：

- `services/split/ruleManager.js`

注意：

- `sheetRules` 应视为旧概念，不再作为当前主路径理解。
- 拆分和合并的模板、别名、规则数组都是分开的。

## 6. 拆分架构

核心文件：

- `services/split/splitService.js`
- `services/split/splitEngine.js`
- `services/split/excelReader.js`
- `services/split/excelWriter.js`
- `services/split/styleCopier.js`
- `services/split/sheetNameMatcher.js`

职责划分：

- `splitService.js`
  负责读取规则、加载源工作簿、加载拆分模板、准备原始 sheet XML 和样式节点。
- `splitEngine.js`
  负责按规则分组并生成输出工作簿。
- `styleCopier.js`
  负责复制表头、行样式、列宽、合并单元格等。
- `excelWriter.js`
  负责文件写出。

## 7. 合并架构

核心文件：

- `services/merge/mergeService.js`
- `services/merge/mergeEngine.js`
- `services/merge/mergeTypes.js`

职责划分：

- `mergeService.js`
  负责加载模板、扫描来源目录、排除模板文件、写出结果。
- `mergeEngine.js`
  负责列映射、供应商排序、数据写入、后处理配置生成。
- `mergeTypes.js`
  负责规则归一化、列号转换、请求校验。

## 8. 优化与兼容修复架构

核心文件：

- `services/optimize/zipUtils.js`
- `services/optimize/templateOptimizer.js`

负责内容：

- 移除外部链接
- 清理空条件格式节点
- 注入保真的条件格式 XML
- 修复 `dxfs`
- 归一化 worksheet 视图
- 安全裁剪尾部空行
- 清理 `NaN` 和部分兼容性属性

这一层是 Office/WPS 兼容问题的核心排障入口。

## 9. 模板架构

模板管理文件：

- `services/templateStore.js`
- `main/ipc.js`

模板作用域：

- `split`
- `merge`

模板目录按作用域分离，不应再把一个模板概念同时套到拆分和合并上。

## 10. 常见问题对应层

- `window.excelTools` 不存在：先看 `main/preload.js`、`main/window.js`
- `An object could not be cloned`：先看 `main/preload.js`、`main/ipcPayload.js`、对应 View 的请求构造
- Office 打开修复弹窗：先看 `services/optimize/zipUtils.js`
- 拆分 sheet 对不上：先看 `services/split/sheetNameMatcher.js` 和 `split.sheetNameAliases`
- 合并列匹配错位：先看 `services/merge/mergeEngine.js` 和 `merge.sheetNameAliases`

## 11. 推荐阅读顺序

1. `docs/PROJECT_HANDBOOK.md`
2. `main/preload.js`
3. `main/ipc.js`
4. `renderer/views/SplitView.vue`
5. `renderer/views/MergeView.vue`
6. `services/split/splitService.js`
7. `services/merge/mergeService.js`
8. `services/optimize/zipUtils.js`
