# 验收清单对照页（最小化）

用于测试与交付阶段快速核对“实现点 -> PRD 条款”。

| 实现点 | 代码/文档位置 | 对应 PRD 条款 | 验收要点 |
| --- | --- | --- | --- |
| UI 增加规则编辑（加载/保存 JSON） | `renderer/index.html`、`renderer/main.js`、`main/ipc.js`、`main/preload.js` | PRD「配置可维护」与「规则可扩展」要求 | 可在界面加载、编辑并保存规则；非法 JSON 给出错误提示。 |
| 执行前校验 | `renderer/main.js`、`main/ipc.js`、`services/common/ruleManager.js` | PRD「安全执行与输入校验」要求 | 未选文件/目录、规则非法、文件不可访问时阻止执行并提示。 |
| 执行中状态展示 | `renderer/main.js`、`renderer/index.html` | PRD「可观察性与任务反馈」要求 | 状态在“校验中 / 执行中 / 完成或失败”之间可见切换。 |
| 执行后摘要（总键数/输出文件数/失败项） | `services/split/splitService.js`、`renderer/main.js` | PRD「结果可追踪」要求 | 任务结束后可直接看到摘要三项。 |
| 主进程维护最近一次任务报告并 IPC 提供 | `main/ipc.js`、`main/preload.js`、`renderer/main.js` | PRD「结果页可复现最近任务」要求 | 重进页面后可读取最近一次任务摘要用于结果页展示。 |

