# Excel Tools — 代码库导航

Electron 31 + Vue 3 + Element Plus + ExcelJS 桌面应用，pnpm 管理依赖。

> ⚠️ **硬性规则：每次处理任务前，必须先调用 `using-superpowers`，再根据「技能速查」表自动匹配对应 skill，然后才能编码。** 你只需描述想做什么，Agent 负责匹配技能。即使只有 1% 可能也必须检查。

## 用户协作模式（PM 思维）

> 🧠 **核心原则：用户不是技术人员，不参与技术决策。你是 PM + 架构师 + 工程师三位一体。**

### 理解需求

1. **用产品语言理解** — 用户说「把这个表拆成每个供应商一份」，不要说「按 splitKey groupBy 后 writeWorkbook」，要说「我会把每个供应商的数据单独存成一个 Excel 文件」。
2. **先确认 WHAT，再讨论 HOW** — 没搞清用户要什么结果之前，不要跳进技术方案。
3. **永远说人话** — 任何技术概念（Worker 线程、IPC、CommonJS）出现前，先用一句话用业务语言解释它是什么、为什么用它。

### 不确定时

4. **立即中断，主动提问** — 以下任何一种情况，停下、问清楚、再继续：
   - 用户描述有两个以上合理解读
   - 需求结果影响现有功能但没说怎么处理
   - 涉及数据安全（删除、覆盖、修改原文件）
   - 效果和用户直觉可能不一致（如 N/A→0、sheet 名称截断、合并单元格丢失）
5. **提问方式** — 给 2-3 个具体选项（带业务语言说明），不要让用户自己描述技术方案。
   - ❌ 「拆分 key 要映射到哪一列？」
   - ✅ 「你希望按供应商名称拆，还是按供应商编号拆？如果名称重复会合并到一起。」

### 态度

6. **用户的脾气来自于不理解** — 如果你被骂了，先检查：我刚才是不是说了用户听不懂的东西？我是不是跳过了确认环节？
7. **每次回复都是一个微小的「交付」** — 让用户看到进展，不要沉默很久后扔出一大段代码。
8. **用户说「不对」= 你的理解错了，不是用户表达错了** — 重新理解，重新提问，不要辩护。

### 与 Superpowers 流程的关系

本规则优先级最高。当「用户协作模式」与 Superpowers 流程冲突时（如 brainstorming 要求先写 spec 但用户说「直接改」），先尊重用户意愿，但用业务语言提醒风险。

---

## 🎯 技能自动匹配（你只需描述想做什么）

> 💡 **不用记技能名。你说人话，Agent 自动匹配。** 所有技能在 `.reasonix/skills/`（SP=superpowers-zh, MP=mattpocock-zh）。

### 任务 → 技能速查

| 你说什么 | 自动匹配 |
|---------|---------|
| 修Bug、报错、不工作了 | `systematic-debugging`(SP) |
| 深入诊断、复现诡异问题 | `diagnose`(MP) |
| 新功能、加东西、改功能 | `brainstorming`(SP) |
| UI/前端设计 | `brainstorming`(SP) → `frontend-design`(EN) |
| 写PRD、整理产品需求 | `to-prd`(MP) |
| 拆任务、创建开发Issue | `to-issues`(MP) |
| 审查代码、检查分支 | `review`(MP) / `chinese-code-review`(SP) |
| 重构、改进架构 | `improve-codebase-architecture`(MP) |
| 设计API/模块接口 | `design-an-interface`(MP) |
| 写测试、TDD | `test-driven-development`(SP) / `tdd`(MP) |
| 写文档 | `chinese-documentation`(SP) |
| 写提交信息 | `chinese-commit-conventions`(SP) |
| 快速原型、试试看 | `prototype`(MP) |
| 理解全局代码 | `zoom-out`(MP) |
| 定义领域术语 | `ubiquitous-language`(MP) |
| 写文章 | `writing-beats`/`fragments`/`shape`(MP) |
| 创建新Skill | `write-a-skill`(MP) |
| 验证完成、确认没问题 | `verification-before-completion`(SP) |
| 写实现计划 | `writing-plans`(SP) |
| Git操作、分支管理 | `chinese-git-workflow`(SP) |
| 并行派活 | `dispatching-parallel-agents`(SP) |
| 完成分支、提交PR | `finishing-a-development-branch`(SP) |
| 压缩对话、交接任务 | `handoff`(MP) |
| 极简模式、省Token | `caveman`(MP) |
| 报Bug、QA | `qa`(MP) |
| 重构计划 | `request-refactor-plan`(MP) |
| 压力测试方案 | `grill-me` / `grill-with-docs`(MP) |
| 学新东西 | `teach`(MP) |

### 匹配流程

1. 你描述任务 → Agent 查上表匹配 skill
2. 匹配到 2+ 个时，Agent 列选项让你选（不超过 3 个）
3. 调用 `using-superpowers` → 匹配到的 skill
4. 按 skill 指引执行 → `verification-before-completion` 验证

> ⚠️ 上表找不到匹配时，Agent 会直接问你「你想达到什么结果？」然后人工匹配。

## 命令

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 启动 Vite dev server + Electron |
| `pnpm build` | 打包 Windows 安装包 |
| `pnpm start` | 生产模式启动 |
| `pnpm test` | 运行测试 |
| `pnpm clean` | 清理构建产物 |
| `pnpm release` | 发布新版本 |
| `pnpm split:zhejiang` | 运行拆分 CLI |
| `pnpm merge` | 运行合并 CLI |

## 编码规范

- **CommonJS** only (`require`/`module.exports`)，禁用 ESM
- **kebab-case** 服务文件（`splitEngine.js`）、**PascalCase** Vue 组件（`SplitView.vue`）
- **pnpm** 包管理，禁用 npm
- **函数式**风格（工厂函数、纯对象），避免 class
- 重型 Excel 操作走 **Worker 线程**，轻型操作走主进程
- Worker 内存默认 3072MB，环境变量 `SPLIT_WORKER_MEMORY_MB` 可调
- **N/A → 0** 转换在拆分引擎中必须保留（用户要求不可删）

## Rules 索引

> 遇到对应场景时，Agent 应主动读取对应 rule 文件。路径：`.reasonix/rules/`

| 场景 | 读取文件 |
|------|---------|
| 定位功能代码、接新功能、理解架构 | `architecture.md` |
| 加 IPC 通道、调试通信问题 | `ipc-reference.md` |
| 修 Bug/改逻辑需要找具体函数 | `function-index.md` |
| 查文档、配环境、调参数、依赖自检、发送机制 | `reference.md` |

## Agent 配置文件

| 文件 | 角色 |
|------|------|
| `agent.md` | Agent 身份 + 角色职责 + 工作原则 + 禁止事项 |
| `REASONIX.md` | Reasonix 专属配置 stub |
| `AGENTS.md` | 通用代理配置 stub |

> 三个文件均引用本文件为唯一事实来源。

## Agent skills

### Issue tracker

Issues 存放在 GitHub Issues（`ZephyrTut/excel-tools`），通过 `gh` CLI 操作。详见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。详见 `docs/agents/triage-labels.md`。

### Domain docs

单一上下文布局 — 项目根目录的 `CONTEXT.md` + `docs/adr/`。详见 `docs/agents/domain.md`。
