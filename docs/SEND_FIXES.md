# 发送工具 — 关键修复记录

> ⚠️ 以下修复是联动链条，修改任一处时必须检查其他两处是否被回退。

---

## 1. 中断机制：不存在群聊不中断发送

### 问题

发送到不存在的微信群时整个发送流程被中断，日志显示"发送已取消"。

### 根因

三层联动问题：

1. **`wechatController.js`** — `execFileAsync` 传了 `AbortSignal`。Node.js 的 `child_process.execFile` 在 `signal.abort()` 后杀进程抛 `AbortError`。
2. **`wechat_sender_wx4.py`** — `_try_clear_wechat_state()` 曾用 `{ESC}` 清除微信搜索框，触发 Electron 全局 `Escape` 快捷键。
3. **`main/ipc.js`** — `globalShortcut.register("Escape")` 拦截系统级 Esc → 调用 `abort()`。

### 修复

| 文件 | 改动 | 关键代码 |
|------|------|----------|
| `services/send/wechatController.js` | `execFile` 不传 `signal` | `{ timeout: 60000 }` （去掉 `signal`） |
| `services/send/wechatController.js` | `isAbortError` 删除 | 只用 `err.name === "AbortError"` 精确判断 |
| `services/send/wechat_sender_wx4.py` | `_try_clear_wechat_state()` 用 `{F5}` | `# 用 F5 而非 ESC，避免与 Electron globalShortcut 冲突` |
| `main/ipc.js` | 全局快捷键为 `Escape` | `// wx4py 已改用 F5，不再冲突` |

### 中断检查正确流程

```
sendService 循环 → 每项开始 → if (signal.aborted) break;
                               ↓ (未中断)
                         执行发送（不传 signal 给子进程）
                               ↓
                         Python 正常返回 JSON 或异常退出
                               ↓
                         记录结果，继续下一项
```

---

## 2. 邮件 MIME：收件人看到 "PK口口口" 而非附件

### 问题

发送带 .xlsx 附件的邮件，收件人（特别是 Coremail 系统）看到 `PK口口口` 乱码而不是文件附件。

### 根因

`sendMail` 不传 `text`/`html` 正文 → nodemailer 跳过 `multipart/mixed` 包裹 → 附件二进制直接成为邮件体 → Coremail 严格 MIME 解析器把二进制当文本渲染。

### 修复

| 文件 | 改动 |
|------|------|
| `services/send/emailSender.js` | 加 `text: "请查收附件"` |
| `services/send/emailSender.js` | 加 `html: "<p>请查收附件</p>"` |
| `services/send/emailSender.js` | 加 `contentDisposition: "attachment"` |

修复后的 MIME 结构：

```
multipart/mixed
  ├── multipart/alternative
  │     ├── text/plain → "请查收附件"
  │     └── text/html → "<p>请查收附件</p>"
  └── application/vnd...xlsx + Content-Disposition: attachment
```

---

## 3. 邮件地址解析：加固全角/隐藏字符

### 问题

部分邮件地址格式（如 `ailsa.lin<ailsa.lin@welding-tech.com.cn>`）解析失败。

### 修复

| 文件 | 改动 |
|------|------|
| `services/send/parseRuleExcel.js` | `normalizeEmailAddress` 清理全角空格、零宽字符、不换行空格 |
| `services/send/parseRuleExcel.js` | `splitComma` 支持全角逗号/分号 |
| `services/send/emailSender.js` | `toAddress` 加调试日志（含 hex dump） |

---

## 4. 发送顺序 + 导出

### 发送顺序：逐行而非分组

**旧**：全部微信 → 全部邮件（按渠道分组）  
**新**：第1行(微信→邮件) → 第2行(微信→邮件) → ...（逐行）

| 文件 | 函数 |
|------|------|
| `services/send/sendService.js` | `buildSendQueue` |

### 导出：包含未发送的

导出 CSV 含三类数据：发送成功/失败 + 渠道跳过 + 未匹配。

| 文件 | 改动 |
|------|------|
| `renderer/views/SendView.vue` | `skippedExportItems` ref + `exportResults` 追加跳过项 |

---

## 5. 单渠道发送按钮 + 全选

### 操作栏

三个均等按钮：`[📱 仅微信] [📧 仅邮件] [📤 全部发送]`

- 按钮在无对应渠道选中文件时禁用
- 单渠道发送时自动取消勾选无该渠道的文件 + 日志 `⏭ 跳过`
- 发送中三个按钮全部禁用

### 全选

列表顶部 `☑ 全选 (N/总数)` — 用 `computed` getter/setter 自动同步状态。

| 文件 | 改动 |
|------|------|
| `renderer/utils/sendPayload.mjs` | `createSendPayload` 加 `channelFilter` |
| `renderer/views/SendView.vue` | 全选 + 三按钮 + 灰化 + 跳过追踪 |

---

## 回退检查清单

如果发现发送工具行为异常，按以下顺序排查：

1. `wechatController.js:192` — `execFileAsync` 是否被重新加上了 `signal`？
2. `wechat_sender_wx4.py:50` — `SendKeys` 是否被改回了 `{ESC}`？
3. `main/ipc.js:625` — `globalShortcut` 是否被改成了组合键？
4. `emailSender.js:60` — `text`/`html` 正文是否还在？
5. `sendService.js:24` — `buildSendQueue` 是否为逐行顺序？
