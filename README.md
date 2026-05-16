# Excel Tools

基于 **Electron + Node.js + ExcelJS** 的可扩展 Excel 自动化桌面平台。  
首版（MVP）聚焦：按规则拆分 Excel；后续扩展：合并汇总、去重、对账、格式转换、批量处理。

## 快速开始

```bash
npm install
npm run dev
```

构建与打包：

```bash
npm run build
```

## 目录结构

```text
excel-tools/
├── main/                  # Electron 主进程与 IPC
├── renderer/              # Vue 3 + Element Plus 前端
├── services/
│   ├── common/            # 日志、规则、错误、路径工具
│   └── split/             # Excel 拆分核心能力
├── config/
│   └── defaultRules.json  # 默认规则
├── docs/                  # 需求/架构/决策文档
└── output/                # 默认输出目录
```

## MVP 能力

- 选择源 `.xlsx` 文件与输出目录
- 按规则对多个 sheet 执行拆分
- 以拆分键输出多个文件，默认清理 Windows 非法文件名
- 保持 sheet 顺序与标题行
- 保留常见格式（列宽、行高、字体、边框、填充、对齐、数字格式、合并单元格）
- 后台 Worker 执行任务，日志与进度实时回传

## 文档索引

- `docs/PRD.md`：产品需求（MVP 范围、验收标准、非功能需求）
- `docs/ARCHITECTURE.md`：技术架构与模块边界
- `docs/DECISIONS.md`：项目关键技术决策（用于后续实现对齐）
- `docs/PROMPTS.md`：AI 协作提示词模板
- `agent.md`：项目代理身份与执行原则
- `config/defaultRules.json`：拆分规则默认配置模板
