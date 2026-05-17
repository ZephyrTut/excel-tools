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
├── services/              # 核心业务逻辑
│   ├── common/            # 日志、规则、错误、路径工具
│   └── split/             # Excel 拆分核心能力
├── scripts/               # 独立命令行工具与测试脚本
├── config/
│   └── defaultRules.json  # 默认规则
├── samples/               # 样本源数据文件 (xlsx)
├── templates/             # 样式模板文件 (xlsx)
├── test/                  # 测试文件目录
├── docs/                  # 需求/架构/决策文档
└── output/                # 默认输出目录
```

## MVP 能力

- 选择源 `.xlsx` 文件与输出目录
- 按规则对多个 sheet 执行拆分
- 以拆分键输出多个文件，默认清理 Windows 非法文件名
- 支持文件名后缀（例如“日报表”），输出文件名可按“拆分键 + 后缀”生成
- 保持 sheet 顺序与标题行
- 保留常见格式（列宽、行高、字体、边框、填充、对齐、数字格式、合并单元格）
- 后台 Worker 执行任务，日志与进度实时回传

## 性能与内存优化

- 拆分引擎已改为**按拆分键逐个构建并写出文件**，不再把所有输出工作簿长期驻留内存，降低峰值内存占用。
- 单行合并单元格映射与“序号”列定位已改为预计算，减少重复扫描。
- 前端任务日志增加上限（保留最近 1000 行），避免长任务日志导致渲染内存持续增长。
- 可通过环境变量调高 Worker 堆内存上限（默认 3072MB）：

```bash
set SPLIT_WORKER_MEMORY_MB=4096
npm run dev
```

## 文档索引

- `docs/PRD.md`：产品需求（MVP 范围、验收标准、非功能需求）
- `docs/ARCHITECTURE.md`：技术架构与模块边界
- `docs/DECISIONS.md`：项目关键技术决策（用于后续实现对齐）
- `docs/SPLIT_LOGIC.md`：拆分逻辑实现说明
- `docs/PROMPTS.md`：AI 协作提示词模板
- `docs/XLSX_OPTIMIZATION_GUIDE.md`：XLSX 性能与内存优化指南
- `config/defaultRules.json`：拆分规则默认配置模板
