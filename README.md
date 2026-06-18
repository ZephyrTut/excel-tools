# Excel Tools

基于 **Electron 31 + Vue 3 + Element Plus + ExcelJS** 的 Windows 桌面 Excel 自动化处理工具。

提供文件拆分、合并汇总、模板优化、批量分发（微信+邮件）四大核心能力，支持带格式/公式的复杂 Excel 操作。

## 快速开始

```bash
# 安装依赖（使用 pnpm）
pnpm install

# 启动开发模式（Vite dev server + Electron）
pnpm dev

# 运行测试
pnpm test

# 生产构建（打包为 NSIS 安装包）
pnpm build
```

## 命令速查

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 启动 Vite + Electron 开发模式 |
| `pnpm build` | 打包 Windows 安装包 |
| `pnpm start` | 生产模式启动 |
| `pnpm test` | 运行全部测试（node:test + vitest） |
| `pnpm test:watch` | 监听模式运行测试 |
| `pnpm release` | 发布新版本 (patch/minor/major) |
| `pnpm setup:python` | 下载便携 Python + uiautomation |

## 核心功能

### 📂 Excel 拆分

按规则将一个工作簿拆成多个文件，支持：
- 按列值分组拆分
- 模板绑定（保留样式、合并单元格、条件格式）
- 自定义输出目录和文件名

### 📊 合并汇总

将多个来源文件按模板合并，支持：
- 智能列头映射（模糊匹配 + 自定义别名）
- 按供应商/分组排序
- 透传 sheet 保留
- 列宽自动复制

### 🔧 模板优化

对 XLSX 做 ZIP/XML 级清理，解决 WPS 与 Office 兼容性问题：
- 清理空单元格/空行
- 自动修正维度
- 移除无用条目
- 修复条件格式引用

### 📤 批量分发

支持微信 + 邮件双渠道分发：
- **规则导入**：Excel 规则表定义"哪个文件发给谁"，支持变量替换 `{{date}}` / `{{fileName}}`
- **文件匹配**：自动扫描文件夹匹配规则
- **微信发送**：Python uiautomation 驱动微信 PC 端自动发送
- **邮件发送**：Nodemailer 封装，支持 SMTP + 附件 + 抄送
- **依赖自检**：启动时自动检测 Python / uiautomation，缺失时尝试自动修复
- **全局 Esc 中断**：即使微信窗口有焦点，按 Esc 中断整个发送流程

## 技术架构

```
Renderer (Vue 3 + Element Plus)
  ↓ window.excelTools.xxx()
preload.js (contextBridge)
  ↓ ipcRenderer.invoke()
ipc.js (ipcMain.handle)
  ├──→ Worker 线程 (split/merge 重型 Excel 操作)
  │     状态通过 task:event 推回 Renderer
  └──→ 主进程直接执行 (optimize/update/send)
```

### 项目结构

```
excel-tools/
├── main/                    # Electron 主进程
│   ├── main.js             # app.whenReady() 入口
│   ├── ipc.js              # 所有 IPC 处理器
│   ├── preload.js          # contextBridge (25+ 个 API)
│   ├── window.js           # BrowserWindow 创建
│   ├── workerRunner.js     # Worker 线程管理
│   ├── updater.js          # 自动更新（双源回退）
│   └── taskWorker.js       # Worker 任务处理
├── renderer/                # Vue 3 前端
│   ├── views/
│   │   ├── SplitView.vue   # 拆分
│   │   ├── MergeView.vue   # 合并
│   │   ├── OptimizeView.vue# 优化
│   │   └── SendView.vue    # 发送（含依赖自检状态）
│   ├── components/
│   │   ├── MergeColumnMappingPanel.vue
│   │   ├── DependencyStatus.vue  # 依赖检查 UI
│   │   ├── RuleTable.vue
│   │   └── LogPanel.vue
│   └── utils/
├── services/                # 后端逻辑
│   ├── split/              # 拆分引擎
│   ├── merge/              # 合并引擎
│   ├── optimize/           # 模板优化
│   ├── send/               # 发送工具
│   │   ├── sendService.js       # 发送编排
│   │   ├── wechatController.js  # Python 微信控制
│   │   ├── wechat_sender_wx4.py # Python wx4py 发送脚本
│   │   ├── emailSender.js       # Nodemailer 封装
│   │   ├── parseRuleExcel.js    # 规则表解析
│   │   └── sendHistory.js       # 发送历史持久化
│   └── dependencyCheck.js  # 外部依赖注册表 + 自检引擎
├── scripts/                # 构建与工具脚本
├── docs/                   # 设计文档与 ADR
├── config/                 # 默认规则配置
└── .vscode/                # Volar + ESLint 配置
```

## 依赖管理

| 依赖 | 用途 | 运行时 |
|------|------|--------|
| Electron 31 | 桌面框架 | 打包自带 |
| Vue 3 | 前端框架 | 打包 |
| Element Plus | UI 组件库 | 按需加载 |
| ExcelJS | Excel 读写 | 打包 |
| Nodemailer | 邮件发送 | 打包 |
| Python 3 | 微信自动化 | 系统安装或打包便携版 |
| uiautomation | 微信 PC 控制 | `pip install uiautomation` 自动安装 |

## 下载与更新

国内用户（无需 VPN）通过阿里云 OSS 加速：

- **下载页面：** https://excel-tools.pages.dev/
- **最新版安装包：** `https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/Excel-Tools-Setup-v{version}.exe`
- **版本信息：** https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/latest.yml

当前最新版本：**v1.2.17**

应用内自动更新策略：
1. 先尝试阿里云 OSS 镜像
2. 回退 GitHub Releases

海外用户从 [GitHub Releases](https://github.com/ZephyrTut/excel-tools/releases) 直接下载。

## 外部依赖自检

启动时自动检测 Python / uiautomation 等外部依赖，缺失时自动尝试修复：

```
✅ 所有依赖就绪 (2/2)          ← 展开查看详情
├─ ✅ Python 3 — 微信发送所需
└─ ✅ uiautomation — 微信 PC 端控制库
```

依赖注册表位于 [services/dependencyCheck.js](services/dependencyCheck.js)，新增依赖只需添加一条 `{ check(), autoFix() }` 记录。

## 文档

- [CLAUDE.md](CLAUDE.md) — 代码库导航与贡献者指南
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 技术架构
- [docs/SPLIT_LOGIC.md](docs/SPLIT_LOGIC.md) — 拆分引擎
- [docs/MERGE_LOGIC.md](docs/MERGE_LOGIC.md) — 合并引擎
- [docs/BUILD.md](docs/BUILD.md) — 构建与发布
- [docs/PRD.md](docs/PRD.md) — 产品需求

## 系统要求

- **操作系统：** Windows 10/11（x64）
- **微信发送要求：** 需安装微信 PC 版并登录；Python 3 或自动打包的便携 Python
