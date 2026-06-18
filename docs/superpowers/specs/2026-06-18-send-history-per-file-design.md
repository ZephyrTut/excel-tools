# 发送历史按文件聚合展示 — 设计文档

> 日期：2026-06-18 · 状态：待审批

## 问题

当前历史表格一行 = 一个 channel（微信或邮件），一个文件发给两个渠道就拆成两行。用户看历史看不出"一个文件 → 哪些渠道"，也与匹配预览区的格式不一致。

## 目标

历史列表改为 **一个文件一行**，同文件的所有渠道 tag 展现在同一行。

## 数据结构

### 当前：targets 按 channel 展开

```json
"targets": [
  { "type": "wechat", "name": "测试群5", "status": "success" },
  { "type": "skip", "name": "未匹配文件.xlsx", "status": "skipped" },
  { "type": "email", "name": "邮件", "status": "stripped", "_fileName": "xxx.xlsx" }
]
```

### 改为：targets 保持不动，计算属性 `historyRows` 按文件 group

```js
const historyRows = computed(() => {
  // targets 中 type=skip 的项单独一行（未匹配文件）
  // 其余按 _fileName / name 分组，一文件一行
});
```

每个 row：
```ts
{
  fileName: string,                  // "上海恺红.xlsx"
  isSkipped: boolean,                // 未匹配 → 灰色
  channelTags: Array<{type, status}> // [{ type: "wechat", status: "success" }, { type: "email", status: "stripped" }]
}
```

## 模板改造

| 列 | 当前 | 改为 |
|----|------|------|
| 文件名 | `getHistoryFileName` 查 target | row.fileName |
| 匹配状态 | 一个 el-tag | v-for channelTags，蓝色（微信已发）/ 绿色（邮件已发）/ 红色（失败）/ 黄色（配置不全） |

## 改动文件

| 文件 | 改什么 |
|------|--------|
| `renderer/views/SendView.vue` | 新增 `historyRows` computed + 模板按新结构渲染 |
| `services/send/sendService.js` | 不变 |

## 风险

低 — 改前端展示层，不碰后端数据。旧历史自动兼容。
