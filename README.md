# Excel Tools

基于 **Electron + Vue 3 + ExcelJS** 的桌面 Excel 处理工具，当前主要提供三类能力：

- 拆分：按 `splitSheetRules` 将一个工作簿拆成多个文件
- 合并：按 `mergeSheetRules` 和模板将多个来源文件汇总
- 优化：对 xlsx 做 ZIP/XML 级清理，提升 Office 兼容性

## 快速开始

安装依赖：

```bash
npm install
```

开发模式：

```bash
npm run dev
```

生产模式启动：

```bash
npm start
```

构建安装包：

```bash
npm run build
```

## 当前项目结构

```text
excel-tools/
├─ main/                  # Electron 主进程、IPC、Worker
├─ renderer/              # Vue 3 页面与组件
├─ services/
│  ├─ split/              # 拆分逻辑
│  ├─ merge/              # 合并逻辑
│  └─ optimize/           # xlsx ZIP/XML 兼容修复
├─ config/
│  └─ defaultRules.json   # 默认规则模板
├─ scripts/               # 命令行脚本与验证脚本
├─ docs/                  # 项目文档
├─ samples/               # 示例输入
├─ templates/             # 模板目录
└─ output/                # 默认输出目录
```

## 核心运行链路

```text
Renderer
  -> window.excelTools.*
  -> main/preload.js
  -> main/ipc.js
  -> service
  -> Worker 或主进程直调
```

关键入口文件：

- `main/preload.js`
- `main/ipc.js`
- `renderer/views/SplitView.vue`
- `renderer/views/MergeView.vue`
- `services/split/splitService.js`
- `services/merge/mergeService.js`
- `services/optimize/zipUtils.js`

## 当前规则模型

请以这些字段为准：

- `split.templateFile`
- `merge.templateFile`
- `split.sheetNameAliases`
- `merge.sheetNameAliases`
- `splitSheetRules`
- `mergeSheetRules`

说明：

- 拆分和合并使用各自独立模板
- 拆分和合并使用各自独立 sheet 别名映射
- 旧的共享 `sheetRules` 概念不再是当前主路径

## 常用命令

```bash
npm run dev
npm start
npm run build
npm run split:zhejiang
npm run compare:zhejiang
npm run merge
npm run compare:merge
npm test
```

补充测试：

```bash
node --test .\main\ipcPayload.test.js
node --test .\services\merge\mergeEngine.test.js
node --test .\services\optimize\zipUtils.test.js
node --test .\services\split\ruleManager.test.js
```

## 常见问题入口

如果遇到这些问题，建议直接从对应文件开始排查：

- `window.excelTools` 不存在
  先看 `main/preload.js`、`main/window.js`
- `An object could not be cloned`
  先看 `main/ipcPayload.js`、对应 View 的请求构造
- WPS 能开、Office 报修复
  先看 `services/optimize/zipUtils.js`
- 拆分 sheet 对不上
  先看 `services/split/sheetNameMatcher.js` 和 `split.sheetNameAliases`
- 合并列错位或某列全空
  先看 `services/merge/mergeEngine.js` 和 `merge.sheetNameAliases`

## 文档入口

建议阅读顺序：

1. [docs/PROJECT_HANDBOOK.md](./docs/PROJECT_HANDBOOK.md)
2. [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
3. [docs/SPLIT_LOGIC.md](./docs/SPLIT_LOGIC.md)
4. [docs/MERGE_LOGIC.md](./docs/MERGE_LOGIC.md)
5. [docs/COMPATIBILITY_FIXES.md](./docs/COMPATIBILITY_FIXES.md)
6. [docs/BUILD.md](./docs/BUILD.md)

## 下载与更新

国内用户（无需 VPN）从 Gitee 仓库查看下载指引：

- **Gitee 仓库：** https://gitee.com/ZephyrTut/excel-tools
- **最新版安装包：** `https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/Excel-Tools-Setup-v{version}.exe`
- **版本信息：** https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/latest.yml

当前最新版本：**v1.2.17**

应用内自动更新优先检查 OSS 镜像，失败后回退 GitHub。

海外 / 有 VPN 用户直接从 [GitHub Releases](https://github.com/ZephyrTut/excel-tools/releases) 下载。

## 更新机制

```
国内用户 → OSS 镜像（阿里云）→ latest.yml → 安装包
                                               ↓ 失败
海外用户 → GitHub Releases → latest.yml → 安装包
```

核心文件：[main/updater.js](./main/updater.js) — 双源回退策略：
1. 先尝试阿里云 OSS（generic provider）
2. 回退 GitHub（github provider）
