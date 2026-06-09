# 发送工具功能增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 改造发送工具的发送历史为表格、增加未匹配项记录、回显功能、Esc中止修复、日志清空按钮、规则执行范围控制

**Architecture:** 前端 SendView.vue 多处UI改造 + 后端 sendService/wechatController 逻辑增强 + 历史数据结构扩展

**Tech Stack:** Electron + Vue 3 + Element Plus + Node.js + Python (uiautomation)

---

### Task 1: 增强历史记录数据结构 — 存储匹配详情和未匹配项

**Files:**
- Modify: `services/send/sendService.js` — `executeSend()` 返回值增强
- Modify: `main/ipc.js` — IPC 参数传递增强
- Modify: `renderer/utils/sendPayload.mjs` — payload 增加 unmatched 字段

- [ ] **Step 1: 修改 createSendPayload 增加 unmatched 参数**

`renderer/utils/sendPayload.mjs`:
```js
export function createSendPayload(matchedItems, wechatFirst, unmatchedItems) {
  const matched = Array.isArray(matchedItems) ? matchedItems : [];
  const unmatched = Array.isArray(unmatchedItems) ? unmatchedItems : [];
  return {
    matched: matched.map((item = {}) => ({
      originalName: asString(item.originalName),
      mappedName: asString(item.mappedName),
      resolvedSubject: asString(item.resolvedSubject),
      channels: asStringArray(item.channels),
      filePath: asString(item.filePath),
      rule: normalizeRule(item.rule || {}),
    })),
    wechatFirst: wechatFirst !== false,
    unmatched,  // ← 新增: 未匹配文件名数组
  };
}
```

- [ ] **Step 2: 修改 executeSend 接受 unmatched 并写入 historyEntry**

`services/send/sendService.js` — `executeSend()` 的 params 增加 `unmatched`，historyEntry 增加 `matchedDetails` 和 `unmatched`：

在 `executeSend` 函数的 `matched` 参数解构后增加 `unmatched = []`：

在构建 `historyTargets` 阶段前，增加 unmatched 的记录：
```js
// 记录未匹配项到历史
for (const umName of unmatched) {
  historyTargets.push({
    type: "skip",
    name: umName,
    status: "skipped",
    error: null,
  });
}
```

在 `historyEntry` 构建时增加 `matchedDetails`：
```js
const historyEntry = {
  date: new Date().toISOString(),
  folderPath,
  files: historyFiles,
  targets: historyTargets,
  matchedDetails: matched.map((item) => ({
    originalName: item.originalName,
    mappedName: item.mappedName,
    resolvedSubject: item.resolvedSubject,
    channels: item.channels,
    rule: {
      wechatGroup: item.rule?.wechatGroup || null,
      emailTo: item.rule?.emailTo || [],
      emailCc: item.rule?.emailCc || [],
      emailSubject: item.rule?.emailSubject || null,
    },
  })),
  unmatched: [...unmatched],
};
```

- [ ] **Step 3: IPC 传递 unmatched 参数**

`main/ipc.js` (`send:send` handler L619-646):
```js
ipcMain.handle("send:send", async (_, payload) => {
  const { matched, wechatFirst, unmatched } = payload || {};
  sendAbortController = new AbortController();
  try {
    const result = await sendService.executeSend({
      matched,
      wechatFirst,
      unmatched: unmatched || [],
      userDataPath: app.getPath("userData"),
      onProgress: ...,
      signal: sendAbortController.signal,
    });
    return deepCloneable({ ... });
  }
});
```

---

### Task 2: 未匹配项写入发送日志和发送结果

**Files:**
- Modify: `renderer/views/SendView.vue` — `startSend()` 中传递 unmatched 并展示

- [ ] **Step 1: startSend 中传递 unmatched 到 IPC**

`renderer/views/SendView.vue` — `startSend()`:
```js
// 修改前
const result = await getApi().sendItems(createSendPayload(selected, true));

// 修改后
const result = await getApi().sendItems(
  createSendPayload(selected, true, matchResult.value.unmatched || [])
);
```

- [ ] **Step 2: 发送结果中展示未匹配项日志**

在 `startSend()` 处理 `result.results` 的循环后面，增加未匹配项日志：
```js
// 显示未匹配项
if (matchResult.value?.unmatched?.length > 0) {
  for (const umName of matchResult.value.unmatched) {
    addLog("warn", `⏭ 跳过 ${umName} (未匹配到规则)`);
  }
}
```

---

### Task 3: 发送历史改为表格展示

**Files:**
- Modify: `renderer/views/SendView.vue` — 替换 div 历史区域为 el-table

- [ ] **Step 1: 将历史区域改为 el-table**

替换 SendView.vue 中 L120-138 的 div 历史区域：

```html
<!-- 发送历史 -->
<el-card class="panel-card" v-if="history.length > 0">
  <template #header>
    <div style="display: flex; align-items: center; justify-content: space-between">
      <span>📜 发送历史 ({{ history.length }})</span>
      <el-button text size="small" type="danger" @click="clearHistory">清空</el-button>
    </div>
  </template>
  <el-table :data="flattenHistory" size="small" stripe style="width: 100%">
    <el-table-column label="日期" width="100">
      <template #default="{ row }">
        <span class="history-date">{{ formatDate(row.date) }}</span>
      </template>
    </el-table-column>
    <el-table-column label="文件名" min-width="130">
      <template #default="{ row }">
        <span class="match-filename">{{ row.fileName }}</span>
      </template>
    </el-table-column>
    <el-table-column label="通道" width="70">
      <template #default="{ row }">
        <span>{{ row.channel === 'wechat' ? '📱' : row.channel === 'email' ? '📧' : '⏭' }}</span>
      </template>
    </el-table-column>
    <el-table-column label="目标" min-width="150">
      <template #default="{ row }">
        <span class="match-target">{{ row.targetName }}</span>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="90">
      <template #default="{ row }">
        <el-tag :type="row.statusTagType" size="small" effect="plain">
          {{ row.statusText }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="130" fixed="right">
      <template #default="{ row }">
        <el-button text size="small" type="primary" @click="reuseHistory(row.entry)">
          🔄 复用
        </el-button>
        <el-button text size="small" type="success" @click="echoHistory(row.entry)">
          📋 回显
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</el-card>
```

- [ ] **Step 2: 添加 flattenHistory 计算属性**

```js
const flattenHistory = computed(() => {
  const result = [];
  for (const entry of history.value.slice(0, 10)) {
    for (const t of entry.targets || []) {
      result.push({
        date: entry.date,
        fileName: t.type === 'skip' ? t.name : (entry.matchedDetails?.find(d => 
          d.originalName === getFileNameForTarget(entry, t)
        )?.originalName || ''),
        channel: t.type,
        targetName: t.type === 'skip' ? '—' : t.name,
        statusTagType: t.status === 'success' ? 'success' : t.status === 'error' ? 'danger' : 'info',
        statusText: t.status === 'success' ? '成功' : t.status === 'error' ? '失败' : '跳过',
        entry: entry,
      });
    }
  }
  return result;
});

function getFileNameForTarget(entry, target) {
  // 从 matchedDetails 中找到对应文件名
  if (!entry.matchedDetails) return '';
  for (const detail of entry.matchedDetails) {
    if (target.type === 'wechat' && detail.rule?.wechatGroup === target.name) {
      return detail.originalName;
    }
    if (target.type === 'email' && detail.rule?.emailTo?.includes(target.name)) {
      return detail.originalName;
    }
  }
  return entry.files?.[0] || '';
}
```

---

### Task 4: 回显功能

**Files:**
- Modify: `renderer/views/SendView.vue` — 新增 `echoHistory()` 方法

- [ ] **Step 1: 实现 echoHistory 方法**

```js
function echoHistory(entry) {
  // 1. 还原匹配信息到匹配预览区
  if (entry.matchedDetails?.length > 0 || entry.unmatched?.length > 0) {
    const restoredMatched = (entry.matchedDetails || []).map((d) => ({
      originalName: d.originalName,
      mappedName: d.mappedName,
      channels: d.channels,
      resolvedSubject: d.resolvedSubject || '',
      selected: true,
      rule: d.rule || {},
      filePath: entry.folderPath ? path.join(entry.folderPath, d.originalName) : '',
    }));
    matchResult.value = {
      matched: restoredMatched,
      unmatched: entry.unmatched || [],
      error: null,
    };
    folderPath.value = entry.folderPath || folderPath.value;
  }

  // 2. 还原发送日志
  logs.value = [];
  if (entry.targets?.length > 0) {
    addLog("info", `📋 回显历史记录 (${formatDate(entry.date)})`);
    for (const t of entry.targets) {
      if (t.type === 'skip') {
        addLog("warn", `⏭ 跳过 ${t.name} (未匹配到规则)`);
      } else {
        const icon = t.type === 'wechat' ? '📱' : '📧';
        const statusIcon = t.status === 'success' ? '✓' : '✗';
        const errorStr = t.error ? ` (${t.error})` : '';
        addLog(
          t.status === 'success' ? 'success' : 'error',
          `${icon} ${t.name} → ${statusIcon}${errorStr}`
        );
      }
    }
  }

  addLog("info", `✅ 已从 ${formatDate(entry.date)} 的历史记录回显`);
}
```

注意：需要在头部引入 `path` (在 Vue SFC 中用 `import path from 'path'` 或自行实现 basename 逻辑)。

---

### Task 5: Esc 中止修复 — 传递 signal 到 execFileAsync

**Files:**
- Modify: `services/send/wechatController.js` — `sendToWechatGroup()` 接受 signal
- Modify: `services/send/sendService.js` — `executeSend()` 传递 signal 到 sendToWechatGroup

- [ ] **Step 1: wechatController.js 传递 signal 到 execFileAsync**

`services/send/wechatController.js` — `sendToWechatGroup()`:
```js
/**
 * @param {string} groupName
 * @param {string} filePath
 * @param {AbortSignal} [signal] - 可选，用于中断
 */
async function sendToWechatGroup(groupName, filePath, signal) {
  // ... 前面不变 ...
  try {
    const [prog, ...args] = pythonCmd.split(" ");
    const { stdout } = await execFileAsync(
      prog,
      [...args, scriptPath, "--group", groupName, "--file", filePath],
      { timeout: 60000, signal }  // ← 加入 signal
    );
    // ... 后面不变 ...
  }
}
```

- [ ] **Step 2: sendService.js 传递 signal 到 sendToWechatGroup**

`services/send/sendService.js` — 在 `executeSend()` 的循环中：
```js
// 修改前
result = await sendToWechatGroup(item.rule.wechatGroup, item.filePath);

// 修改后
result = await sendToWechatGroup(item.rule.wechatGroup, item.filePath, signal);
```

**效果**：按 Esc 时 `sendAbortController.abort()` 触发 → `execFileAsync` 的 signal 变为 aborted → Node.js 自动 SIGTERM kill Python 子进程 → 立即中断，无需等待 60 秒超时。

---

### Task 6: 发送日志清空按钮

**Files:**
- Modify: `renderer/views/SendView.vue` — 日志区增加清空按钮

- [ ] **Step 1: 日志区 header 增加清空按钮**

在日志区 header 的导出按钮旁增加清空：
```html
<template #header>
  <div style="display: flex; align-items: center; justify-content: space-between">
    <span>📊 发送日志</span>
    <div>
      <el-button v-if="logs.length > 0" text size="small" type="danger" @click="clearLogs" style="margin-right: 4px">
        🗑 清空
      </el-button>
      <el-button v-if="sendResults.length > 0" text size="small" type="primary" @click="exportResults">
        📥 导出
      </el-button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 新增 clearLogs 方法**

```js
function clearLogs() {
  logs.value = [];
  sendResults.value = [];
  sendProgress.value = 0;
}
```

---

### Task 7: 规则执行范围控制

**Files:**
- Modify: `services/send/parseRuleExcel.js` — 规则对象增加 `originalRow` 字段
- Modify: `renderer/views/SendView.vue` — 配置区增加行范围输入
- Modify: `services/send/ruleMatcher.js` — 或使用时过滤

- [ ] **Step 1: parseRuleExcel 记录 originalRow**

`services/send/parseRuleExcel.js` — 在 push rule 时增加行号：
```js
rules.push({
  originalName,
  mappedName: mappedName || originalName,
  channels,
  wechatGroup: hasWechat ? wechatGroup : null,
  emailSubject: hasEmail ? emailSubject : null,
  emailTo: normalizeEmailList(splitComma(emailToStr)),
  emailCc: normalizeEmailList(splitComma(emailCcStr)),
  originalRow: r,  // ← 新增：Excel 中的行号
});
```

- [ ] **Step 2: SendView.vue 增加行范围输入**

在配置区 SMTP 配置行下方，增加规则行范围控件：
```html
<el-form-item label="规则范围">
  <div style="display: flex; align-items: center; gap: 4px">
    <el-input-number v-model="ruleStartRow" :min="2" :max="9999" size="small" style="width: 90px" placeholder="起始行" />
    <span>～</span>
    <el-input-number v-model="ruleEndRow" :min="2" :max="9999" size="small" style="width: 90px" placeholder="结束行" />
    <el-text size="small" type="info" style="margin-left: 4px">
      (留空=全部，含表头行1)
    </el-text>
  </div>
</el-form-item>
```

新增响应式状态：
```js
const ruleStartRow = ref(null);
const ruleEndRow = ref(null);
```

- [ ] **Step 3: refreshMatch 时按行范围过滤规则**

`refreshMatch()` 中，调用 `getSendRules()` 或使用本地 `rules` 时，根据 `ruleStartRow`/`ruleEndRow` 过滤。

因 `rules` 已在前端通过 `importSendRules` 加载，需要在匹配时动态过滤：

```js
function getActiveRules() {
  let activeRules = rules.value;
  if (ruleStartRow.value) {
    activeRules = activeRules.filter(r => (r.originalRow || 0) >= ruleStartRow.value);
  }
  if (ruleEndRow.value) {
    activeRules = activeRules.filter(r => (r.originalRow || 0) <= ruleEndRow.value);
  }
  return activeRules;
}
```

但当前 `matchSendFiles` 在服务端调用了 `matchFolderFiles` 并内部 `getRules()` 读取 `sendRules.json`。为了让行范围生效，有两种方案：

**方案 A**（推荐）：在 renderer 端将过滤后的 rules 传给 IPC，服务端用传入的 rules 替代从文件读取。

修改 IPC 和 matchFolderFiles 支持传入自定义 rules：
```js
// ipc.js send:match-files handler
ipcMain.handle("send:match-files", async (_, { folderPath, rules }) => {
  return sendService.matchFolderFiles(folderPath, app.getPath("userData"), rules);
});

// sendService.matchFolderFiles 增加 rules 参数
async function matchFolderFiles(folderPath, userDataPath, customRules) {
  const rules = customRules || await getRules(userDataPath);
  // ... 后面不变
}

// SendView.vue refreshMatch
async function refreshMatch() {
  const result = await getApi().matchSendFiles(folderPath.value, getActiveRules());
  // ...
}
```

修改 preload.js：
```js
matchSendFiles: (folderPath, rules) =>
  ipcRenderer.invoke("send:match-files", { folderPath, rules }),
```

---

### 执行顺序

| 步骤 | 依赖 | 风险 |
|------|------|------|
| Task 1: 数据结构增强 | 无 | 低 — 向后兼容 |
| Task 2: 未匹配项写入 | Task 1 | 低 |
| Task 3: 历史改表格 | Task 1 | 中 — UI 改动 |
| Task 4: 回显功能 | Task 1, 3 | 中 |
| Task 5: Esc 中止 | 无 | 低 — 信号传递 |
| Task 6: 日志清空 | 无 | 低 |
| Task 7: 规则范围 | parseRuleExcel | 中 — IPC 接口变更 |
