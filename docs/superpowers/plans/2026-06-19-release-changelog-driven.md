# Release CHANGELOG-Driven 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 发布流程改为人机协作：release.js 展示提交列表 → 用户提炼 → 写入 CHANGELOG.md → CI 统一读取 CHANGELOG.md 生成 GitHub Release 和 Cloudflare Pages。

**Architecture:** CHANGELOG.md 作为唯一数据源。release.js 暂停等用户粘贴更新日志后插入顶部；release.yml 解析 CHANGELOG.md 提取版本段落用于 GitHub Release body 和 Cloudflare Pages HTML。

**Tech Stack:** Node.js (readline), pwsh (release.yml), CHANGELOG.md Markdown

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `scripts/release.js` | 展示提交、等待输入、写入 CHANGELOG.md |
| `.github/workflows/release.yml` | CI：从 CHANGELOG.md 提取版本内容渲染到 GitHub Release 和 Cloudflare Pages |
| `scripts/generate-changelog.js` | 不改，保留备用 |

---

### Task 1: release.js — 展示提交列表 + 暂停等待输入

**Files:**
- Modify: `scripts/release.js:56-70`（在确认发布后、写 package.json 前插入新逻辑）

- [ ] **Step 1: 添加获取上次 tag 和提交列表的函数**

在 `main()` 函数中，`confirm` 确认后、写 package.json 前插入：

```js
  // 2.5. 展示提交列表，等待用户提炼更新日志
  const lastTag = (() => {
    try {
      return execSync("git describe --tags --abbrev=0", { encoding: "utf-8" }).trim();
    } catch {
      return null;
    }
  })();

  if (lastTag) {
    console.log(`\n📋 自 ${lastTag} 以来的提交:\n`);
    try {
      const log = execSync(`git log ${lastTag}..HEAD --oneline --no-decorate`, { encoding: "utf-8" });
      console.log(log);
    } catch {
      console.log("  (无法获取提交列表)");
    }
  } else {
    console.log("\n📋 首次发布，所有提交:\n");
    try {
      const log = execSync("git log --oneline --no-decorate", { encoding: "utf-8" });
      console.log(log);
    } catch {
      console.log("  (无法获取提交列表)");
    }
  }

  console.log("\n请提炼更新日志（贴入后按 Enter 两次结束）:\n");

  const releaseNotes = await new Promise((resolve) => {
    const lines = [];
    let blankCount = 0;
    rl.on("line", (input) => {
      if (input.trim() === "") {
        blankCount++;
        if (blankCount >= 2) {
          rl.removeAllListeners("line");
          resolve(lines.join("\n").trim());
          return;
        }
      } else {
        blankCount = 0;
      }
      lines.push(input);
    });
  });

  if (!releaseNotes) {
    console.log("更新日志为空，退出");
    rl.close();
    process.exit(1);
  }
```

**注意：** 这段代码需要使用 `readline` 的多行输入模式。但由于 `readline` 已创建 `rl` 实例且用了 `rl.question`，直接复用有问题。需要改为逐行监听模式。

- [ ] **Step 2: 重构 readline 使用方式**

当前 `release.js` 用 `rl.question` 做交互。多行输入需要 `rl.on("line", ...)` 模式。改动：将整个交互从 `question` 模式改为统一的 `on("line")` 状态机模式。或者更简单：提交列表用 `execSync` 打印后，新建一个 `readline` 实例读取多行输入。

实际实现（更简方案——新建独立 readline 实例）：

```js
  // 展示提交列表后，用新 readline 实例读多行输入
  const releaseNotes = await new Promise((resolve) => {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const lines = [];
    let blankCount = 0;
    console.log("输入更新日志（贴入后按 Enter 两次结束）:");
    rl2.on("line", (input) => {
      if (input.trim() === "") {
        blankCount++;
        if (blankCount >= 2) {
          rl2.close();
          resolve(lines.join("\n").trim());
          return;
        }
      } else {
        blankCount = 0;
      }
      lines.push(input);
    });
  });
```

- [ ] **Step 3: 验证 commit 列表展示**

运行: `node scripts/release.js`，选 1 (patch)，看提交列表是否正确显示。

- [ ] **Step 4: Commit**

```bash
git add scripts/release.js
git commit -m "feat(release): show commit list and accept curated release notes"
```

---

### Task 2: release.js — 写入 CHANGELOG.md

**Files:**
- Modify: `scripts/release.js:70-82`（替换 generate-changelog 调用）

- [ ] **Step 1: 替换 generate-changelog 调用为写入 CHANGELOG.md**

删除 `generate-changelog.js --write` 调用，改为写入提炼内容到 CHANGELOG.md：

```js
  // 3. 写入 CHANGELOG.md
  const CHANGELOG_PATH = path.join(__dirname, "..", "CHANGELOG.md");
  const date = new Date().toISOString().slice(0, 10);
  const newSection = `## [${tag}] - ${date}\n\n${releaseNotes}\n\n`;

  let existing = "";
  try {
    existing = fs.readFileSync(CHANGELOG_PATH, "utf-8");
  } catch {
    existing = "# Changelog\n\n";
  }

  // 插入到标题行之后
  const headerEnd = existing.indexOf("\n\n");
  const header = existing.slice(0, headerEnd + 2);
  const body = existing.slice(headerEnd + 2);
  const newChangelog = header + newSection + body;

  fs.writeFileSync(CHANGELOG_PATH, newChangelog);
  console.log(`✓ CHANGELOG.md 已更新: ${tag}`);
```

- [ ] **Step 2: 确认不再调用 generate-changelog.js**

搜索 `release.js` 中所有 `generate-changelog` 引用并移除：

```bash
grep -n "generate-changelog" scripts/release.js
```

确保删除 `execSync('node scripts/generate-changelog.js --write', ...)` 及其 try/catch。

- [ ] **Step 3: 验证 CHANGELOG.md 写入**

手动测试：运行 `node scripts/release.js`，选 1 (patch)，粘贴示例日志，检查 `CHANGELOG.md` 是否正确生成。

```bash
git checkout -- CHANGELOG.md package.json  # 回滚测试改动
```

- [ ] **Step 4: Commit**

```bash
git add scripts/release.js
git commit -m "feat(release): write curated release notes to CHANGELOG.md"
```

---

### Task 3: release.yml — GitHub Release body 读取 CHANGELOG.md

**Files:**
- Modify: `.github/workflows/release.yml:220-235`（Generate release notes 步骤附近）

- [ ] **Step 1: 替换 GitHub Release body 生成逻辑**

找到 `Generate release notes` 步骤（当前用 pwsh 脚本生成 `release-body.md`）。改为从 CHANGELOG.md 提取当前版本段落：

```yaml
      - name: Generate release notes from CHANGELOG
        shell: pwsh
        run: |
          $currentTag = "${{ env.CURRENT_TAG }}"
          $changelog = Get-Content -Path CHANGELOG.md -Raw -Encoding UTF8
          # 提取当前版本段落：匹配 "## [vX.Y.Z] - YYYY-MM-DD" 到下一个 "## [v" 或文件结束
          $pattern = "(?s)## \[$currentTag\].*?(?=\n## \[v|\z)"
          if ($changelog -match $pattern) {
            $body = $matches[0].Trim()
          } else {
            $body = "## $currentTag`n`n更新内容待补充"
          }
          Set-Content -Path "$env:RUNNER_TEMP/release-body.md" -Value $body -Encoding UTF8
```

**注意：** 需要确认现有的 `Generate release notes` 步骤的精确行号，找到并替换。

- [ ] **Step 2: 验证 body_path 引用**

确认 `softprops/action-gh-release@v2` 步骤的 `body_path` 仍然指向 `${{ runner.temp }}/release-body.md`。

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat(ci): read GitHub Release body from CHANGELOG.md"
```

---

### Task 4: release.yml — Cloudflare Pages 读取 CHANGELOG.md

**Files:**
- Modify: `.github/workflows/release.yml:237-316`（Deploy download page to Cloudflare Pages 步骤）

- [ ] **Step 1: 替换版本列表生成逻辑**

将当前用 `gh release view` 逐版取 body 的逻辑，改为解析 CHANGELOG.md 中所有版本段落：

```yaml
      - name: Deploy download page to Cloudflare Pages
        continue-on-error: true
        timeout-minutes: 5
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        shell: pwsh
        run: |
          if (-not $env:CLOUDFLARE_API_TOKEN) {
            Write-Host "CLOUDFLARE_API_TOKEN is empty, skip Cloudflare Pages deploy."
            exit 0
          }

          $currentVersion = "${{ github.ref_name }}"
          $changelog = Get-Content -Path CHANGELOG.md -Raw -Encoding UTF8

          # 解析所有 ## [vX.Y.Z] 段落
          $versionBlocks = [regex]::Matches($changelog, '(?s)## \[(v[\d.]+)\].*?(?=\n## \[v|\z)')
          
          $versionItems = ""
          foreach ($block in $versionBlocks) {
            $ver = $block.Groups[1].Value
            $content = $block.Groups[0].Value
            $badge = if ($ver -eq $currentVersion) { ' <span class="badge">★ 最新</span>' } else { '' }
            
            # 提取更新内容（跳过 "## [vX.Y.Z] - date" 标题行）
            $contentLines = $content -split '\n'
            $bodyLines = $contentLines[1..$contentLines.Count] | Where-Object { $_ -notmatch '^\s*$' } | ForEach-Object { "<li>$_</li>" }
            $changelogHtml = if ($bodyLines) { "<ul>" + ($bodyLines -join '') + "</ul>" } else { "" }

            $versionItems += '<li>'
            $versionItems += '<a href="https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/Excel-Tools-Setup-' + $ver + '.exe">' + $ver + '</a>' + $badge
            if ($changelogHtml) {
              $versionItems += '<details><summary>更新内容</summary>' + $changelogHtml + '</details>'
            }
            $versionItems += '</li>'
          }

          $lines = @(
            '<!DOCTYPE html>',
            '<html lang="zh-CN">',
            # ... (keep existing HTML template unchanged)
          )
```

- [ ] **Step 2: 保持现有 HTML 模板不变**

上面只替换 `$versionItems` 的生成逻辑，`$lines` 数组的 HTML 模板保持原样。确认没有误改动样式和结构。

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat(ci): Cloudflare Pages reads version changelogs from CHANGELOG.md"
```

---

### Task 5: 验证

- [ ] **Step 1: 语法检查**

```bash
node -e "require('./scripts/release.js')" || true  # release.js 含 readline 交互，用 || true
# 手动检查 release.yml YAML 语法：
# pnpm exec actionlint .github/workflows/release.yml || true
```

- [ ] **Step 2: 单元测试**

```bash
pnpm test
```
预期：47+ pass, 1 pre-existing fail (releaseWorkflow)

- [ ] **Step 3: Commit CHANGELOG.md 更新**

```bash
git add docs/superpowers/specs/2026-06-19-release-changelog-driven-design.md
git commit -m "docs: add release changelog-driven design spec"
```
