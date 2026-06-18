# Send Channel Independent Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple wechat/email channel validation so a rule with one valid channel is still used (instead of being discarded), with warnings for the stripped channel.

**Architecture:** `parseRuleExcel` strips invalid channels rather than skipping the row. A `strippedChannels` field is persisted to JSON. `matchFolderFiles` generates warnings from it. `SendView` displays warnings at match time, send time, and history recall.

**Tech Stack:** Node.js CommonJS, ExcelJS, Vue 3

---

### Task 1: Decouple channel validation in parseRuleExcel

**Files:**
- Modify: `services/send/parseRuleExcel.js:106-139`

- [ ] **Step 1: Replace the bundled validation block**

Replace the block from line 106 (`const hasWechat`) through the `rules.push(...)` at line 139 with independent validation:

```js
    const hasWechat = channels.includes("wechat");
    const hasEmail = channels.includes("email");

    const wechatValid = hasWechat && !!wechatGroup;
    const emailValid = hasEmail && !!emailToStr && !!emailSubject;

    const strippedChannels = [];
    if (hasWechat && !wechatValid) {
      warnings.push(`行 ${r} (${originalName}): 包含微信分发但微信群名为空，已跳过微信发送`);
      channels.splice(channels.indexOf("wechat"), 1);
      strippedChannels.push("wechat");
    }
    if (hasEmail && !emailValid) {
      const missing = [];
      if (!emailToStr) missing.push("收件人");
      if (!emailSubject) missing.push("邮件主题");
      warnings.push(`行 ${r} (${originalName}): 邮件${missing.join("、")}为空，已跳过邮件发送`);
      channels.splice(channels.indexOf("email"), 1);
      strippedChannels.push("email");
    }

    if (channels.length === 0) {
      warnings.push(`行 ${r} (${originalName}): 所有渠道均无效，跳过`);
      continue;
    }

    function splitComma(s) {
      if (!s) return [];
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }

    rules.push({
      originalName,
      mappedName: mappedName || originalName,
      channels,
      wechatGroup: wechatValid ? wechatGroup : null,
      emailSubject: emailValid ? emailSubject : null,
      emailTo: normalizeEmailList(splitComma(emailValid ? emailToStr : "")),
      emailCc: normalizeEmailList(splitComma(emailValid ? emailCcStr : "")),
      strippedChannels,
      originalRow: r,
    });
```

- [ ] **Step 2: Verify parseRuleExcel tests still pass**

```bash
cd "C:\Users\XXK\Desktop\work\excel tools\excel-tools" && pnpm test 2>&1 | findstr /C:"parseRuleExcel" /C:"# pass" /C:"# fail"
```

Expected: All parseRuleExcel tests pass (tests 22-27).

- [ ] **Step 3: Commit**

```bash
git add services/send/parseRuleExcel.js
git commit -m "feat: decouple wechat/email channel validation with strippedChannels"
```

---

### Task 2: Add warnings generation in matchFolderFiles and history strippedChannels

**Files:**
- Modify: `services/send/sendService.js:73-98` (matchFolderFiles)
- Modify: `services/send/sendService.js:405-421` (historyEntry.matchedDetails)

- [ ] **Step 1: Add warnings to matchFolderFiles return value**

Replace lines 92-98 in `matchFolderFiles`:

```js
  const { matched, unmatched } = matchFiles(files, rules);

  for (const m of matched) {
    m.filePath = path.join(folderPath, m.originalName);
  }

  // 从规则的 strippedChannels 生成警告
  const warnings = [];
  for (const m of matched) {
    const sc = m.rule && m.rule.strippedChannels;
    if (sc && sc.length > 0) {
      const strippedLabels = sc.map(c => c === "wechat" ? "微信" : "邮件").join("、");
      warnings.push(`${m.originalName} 仅通过${m.channels.map(c => c === "wechat" ? "微信" : "邮件").join("、")}发送（${strippedLabels}渠道配置不全）`);
    }
  }

  return { matched, unmatched, warnings };
```

- [ ] **Step 2: Add strippedChannels to historyEntry.matchedDetails**

Replace lines 410-421 in `executeSend`:

```js
    matchedDetails: matched.map((item) => ({
      originalName: item.originalName,
      mappedName: item.mappedName,
      resolvedSubject: item.resolvedSubject || null,
      channels: item.channels,
      strippedChannels: item.rule?.strippedChannels || [],
      rule: {
        wechatGroup: item.rule?.wechatGroup || null,
        emailTo: item.rule?.emailTo || [],
        emailCc: item.rule?.emailCc || [],
        emailSubject: item.rule?.emailSubject || null,
      },
    })),
```

- [ ] **Step 3: Update JSDoc type annotation for matchFolderFiles**

Replace line 71:

```js
 * @returns {Promise<{matched: Array, unmatched: string[], warnings?: string[], error?: string}>}
```

- [ ] **Step 4: Verify no syntax errors**

```bash
node -e "require('./services/send/sendService.js'); console.log('OK')"
```

- [ ] **Step 5: Commit**

```bash
git add services/send/sendService.js
git commit -m "feat: add warnings from strippedChannels to matchFolderFiles and history"
```

---

### Task 3: Display warnings in SendView

**Files:**
- Modify: `renderer/views/SendView.vue:648-676` (refreshMatch)
- Modify: `renderer/views/SendView.vue:720-730` (startSend log)
- Modify: `renderer/views/SendView.vue:883-904` (echoHistory)

- [ ] **Step 1: Show warnings after match in refreshMatch**

Add after line 673 (`addLog("info", ...)`):

```js
    // 展示渠道不全的警告
    if (result.warnings && result.warnings.length > 0) {
      for (const w of result.warnings) {
        addLog("warn", `⚠ ${w}`);
      }
    }
```

- [ ] **Step 2: Add strippedChannels to plainRules passed to matchSendFiles**

In `refreshMatch`, the plainRules stripping currently only copies `channels`, `wechatGroup`, `emailSubject`, etc. (lines 659-667). Add `strippedChannels`:

```js
      strippedChannels: [...(r.strippedChannels || [])],
```

Place this after line 661 (`channels: [...(r.channels || [])],`).

- [ ] **Step 3: Show stripped channel warnings in send log**

After the results loop (after line 730), add:

```js
    // 对渠道不全的文件显示警告
    const seenWarn = new Set();
    for (const m of (matchResult.value?.matched || [])) {
      const sc = m.rule && m.rule.strippedChannels;
      if (sc && sc.length > 0 && !seenWarn.has(m.originalName)) {
        seenWarn.add(m.originalName);
        const strippedLabels = sc.map(c => c === "wechat" ? "微信" : "邮件").join("、");
        const usedLabels = m.channels.map(c => c === "wechat" ? "微信" : "邮件").join("、");
        addLog("warn", `⚠ ${m.originalName} 仅通过${usedLabels}发送（${strippedLabels}渠道配置不全）`);
      }
    }
```

- [ ] **Step 4: Restore strippedChannels warnings in echoHistory**

After line 926 (closing `}` of the targets loop), add:

```js
      // 还原渠道不全警告
      const seenWarn = new Set();
      if (entry.matchedDetails) {
        for (const md of entry.matchedDetails) {
          if (md.strippedChannels && md.strippedChannels.length > 0 && !seenWarn.has(md.originalName)) {
            seenWarn.add(md.originalName);
            const strippedLabels = md.strippedChannels.map(c => c === "wechat" ? "微信" : "邮件").join("、");
            const usedLabels = md.channels.map(c => c === "wechat" ? "微信" : "邮件").join("、");
            addLog("warn", `⚠ ${md.originalName} 仅通过${usedLabels}发送（${strippedLabels}渠道配置不全）`);
          }
        }
      }
```

- [ ] **Step 5: Verify Vite build passes**

```bash
cd "C:\Users\XXK\Desktop\work\excel tools\excel-tools" && pnpm build:renderer 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add renderer/views/SendView.vue
git commit -m "feat: display stripped channel warnings in match, send log, and history"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd "C:\Users\XXK\Desktop\work\excel tools\excel-tools" && pnpm test 2>&1 | findstr /C:"# pass" /C:"# fail"
```

Expected: No regressions (same or better pass count).

- [ ] **Step 2: Smoke test with test data**

Manually verify with `test/发送规则模板2.xlsx` and `test/武义分表5-19/`:
1. Import the rule template → should show warnings about partial channels
2. Select the folder → all 6 files should match (no 4 unmatched)
3. Files with only wechat should show `⚠ 仅通过微信发送（邮件渠道配置不全）`
4. Send → files should send via their valid channels
