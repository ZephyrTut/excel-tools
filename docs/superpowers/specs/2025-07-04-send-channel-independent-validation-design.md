# Send Rule Validation — 微信/邮件渠道独立验证

**Date:** 2025-07-04  
**Status:** approved

## 背景

发送工具的规则模板支持一行同时配置「微信」和「邮件」两个渠道。当前 `parseRuleExcel.js` 的验证逻辑将两个渠道捆绑在一起：只要任一渠道的必填字段为空，整行都被丢弃。

**问题场景**：规则行 `上海恺红` 配置了 channels="微信,邮件"、wechatGroup="测试群8"，但 emailTo 和 emailSubject 为空。旧逻辑会跳过整行 → 文件被标记为「未匹配」→ 微信发送也被阻断。

## 设计

### 核心改动：`services/send/parseRuleExcel.js`

将渠道验证改为**独立判断**，并记录被剥离的渠道：

```
旧逻辑（第 109-120 行）:
  if (hasWechat && !wechatGroup) → warning + continue (整行跳过)
  if (hasEmail && !emailToStr)   → warning + continue
  if (hasEmail && !emailSubject) → warning + continue

新逻辑:
  1. wechatValid = hasWechat AND wechatGroup 非空
  2. emailValid  = hasEmail  AND emailTo 非空 AND emailSubject 非空
  
  3. 若声明了微信但 wechatGroup 为空 → warning + 从 channels 移除 "wechat" + 记入 strippedChannels
  4. 若声明了邮件但必填字段为空 → warning + 从 channels 移除 "email" + 记入 strippedChannels
  
  5. channels = 过滤后的有效渠道列表
  6. 若 channels 为空 → warning + continue (整行跳过，与旧行为一致)
     否则 → 保留规则，channels 仅含有效渠道，strippedChannels 记录被移除的渠道
```

规则对象新增字段 `strippedChannels: string[]`（如 `["email"]`），序列化到 `sendRules.json` 持久化。

**示例**：
| 行 | channels 声明 | wechatGroup | emailTo | emailSubject | 旧结果 | 新结果 |
|----|-------------|-------------|---------|-------------|--------|--------|
| 上海恺红 | 微信,邮件 | 测试群8 | (空) | (空) | ⚠ 跳过 | ✅ channels=["wechat"], strippedChannels=["email"] |
| 东莞硅翔 | 微信,邮件 | (空) | a@b.com | 日报 | ⚠ 跳过 | ✅ channels=["email"], strippedChannels=["wechat"] |
| 芜湖博康 | 微信,邮件 | (空) | (空) | (空) | ⚠ 跳过 | ⚠ 跳过 (两个都无效) |

### 透传改动：`services/send/sendService.js`

`matchFolderFiles()` 返回对象增加 `warnings` 字段：

```js
// 旧: return { matched, unmatched }
// 新: return { matched, unmatched, warnings }
```

warnings 来源：遍历 matched 规则的 `strippedChannels`，生成形如 `"xxx.xlsx 仅通过微信发送（邮件渠道配置不全）"` 的提示。

`executeSend()` 发送日志中：对每个 matched 项的 strippedChannels 输出 warn 级别日志。

历史记录 `historyEntry` 中：对 strippedChannels 非空的文件，在 `matchedDetails` 中记录 `strippedChannels` 字段，方便回显时还原警告。

### 前端改动：`renderer/views/SendView.vue`

三处改动：

1. **`refreshMatch()`** — 匹配完成后展示 warnings：
```js
if (result.warnings?.length > 0) {
  for (const w of result.warnings) addLog("warn", w);
}
```

2. **发送日志** — `startSend()` 完成后，对 strippedChannels 输出提示（通过 result.results 或从 matchResult.matched 读取）。

3. **历史回显** — `echoHistory()` 还原时，从 `matchedDetails.strippedChannels` 生成对应的 warn 日志。

### 不改动的部分

- `ruleMatcher.js`：匹配逻辑不变，仍按 originalName 精确匹配
- `executeSend()`：发送队列构建不变，channels 已被过滤
- wx4py 发送效率：暂不优化

## 影响范围

| 文件 | 改动行数 | 风险 |
|------|---------|------|
| `services/send/parseRuleExcel.js` | ~20 行 | 低 — 纯逻辑重构 + 新增 strippedChannels |
| `services/send/sendService.js` | ~10 行 | 低 — 增加 warnings 生成 + 历史 strippedChannels |
| `renderer/views/SendView.vue` | ~12 行 | 低 — refreshMatch/startSend/echoHistory 三处 warn 展示 |
