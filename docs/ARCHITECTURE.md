# 技术架构与模块设计

## 1. 技术栈

- 桌面框架：Electron
- 前端：Vue 3 + Element Plus
- Excel 引擎：ExcelJS
- 配置：JSON 本地文件
- 日志：本地日志模块（可扩展文件落盘）
- 打包：electron-builder

## 2. 分层原则

1. **Renderer（UI 层）**：文件选择、规则编辑、日志展示、任务状态
2. **Main（进程编排层）**：窗口、IPC、任务调度、进程生命周期
3. **Service（业务层）**：拆分任务编排、规则校验、异常收敛
4. **Engine（Excel 引擎层）**：读取、分组、写入、格式复制
5. **Infrastructure（基础能力）**：日志、配置、路径与文件名处理

## 3. 实际目录

```text
excel-tools/
├── package.json
├── electron-builder.json
├── main/
│   ├── main.js
│   ├── ipc.js
│   └── window.js
├── renderer/
│   ├── index.html
│   ├── main.js
│   ├── views/
│   ├── components/
│   └── stores/
├── services/
│   ├── split/
│   │   ├── splitService.js
│   │   ├── splitEngine.js
│   │   ├── excelReader.js
│   │   ├── excelWriter.js
│   │   ├── styleCopier.js
│   │   ├── splitTypes.js
│   │   ├── ruleManager.js
│   │   ├── pathUtil.js
│   │   └── errors.js
│   ├── common/     (预留共享工具)
│   └── merge/      (预留)
├── scripts/        (独立命令行/测试脚本)
├── samples/        (样本源数据文件)
├── templates/      (样式模板文件)
├── test/           (测试文件目录)
├── config/
│   └── defaultRules.json
├── docs/
└── output/         (默认输出目录)
```

## 4. 核心模块职责

- `splitService`：拆分入口、参数校验、任务生命周期管理
- `splitEngine`：按规则拆分、分组、输出编排
- `excelReader`：读取 workbook/sheet、抽取标题与数据区
- `excelWriter`：输出工作簿、sheet 顺序与标题保留
- `styleCopier`：复制常见样式与合并单元格
- `ruleManager`：加载/保存/校验规则 JSON
- `pathUtil`：文件名清洗、输出路径解析
- `errors`：统一错误码与 AppError 类

## 5. 后台执行策略

- UI 触发任务后通过 IPC 发送到 Main
- Main 将重任务放入 Worker Thread 执行
- Worker 持续回传进度与日志事件
- Renderer 只负责渲染状态，不执行 Excel 重计算

> 目标：避免 UI 卡顿，支持后续并发任务队列扩展。

## 6. 关键数据流

1. Renderer 提交 `inputFile + outputDir + rules`
2. Main 校验并创建任务上下文（taskId）
3. Worker 执行拆分（读取 -> 分组 -> 写入）
4. 日志与进度通过 IPC 增量回传
5. 任务完成后返回输出摘要（文件数、耗时、异常）

## 7. 扩展点

- 新增功能（合并、汇总、去重、对账）按 `services/<feature>/` 接入
- 复用 `ruleManager/logger/pathUtil/errors`
- 通过统一任务总线（任务类型 + payload）接入 UI
