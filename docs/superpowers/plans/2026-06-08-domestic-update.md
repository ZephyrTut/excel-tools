# 国内更新方案 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现双源更新机制，国内用户从 Gitee 镜像更新（无需 VPN），回退到 GitHub。

**Architecture:** GitHub Actions 构建后同步安装包到 Gitee release 分支；electron-updater 在 `updater.js` 中先尝试 generic provider（Gitee raw URL），失败后回退到 GitHub provider。

**Tech Stack:** electron-updater, GitHub Actions, Gitee

---

### Task 1: 修改 `main/updater.js` — 双源回退

**Files:**
- Modify: `main/updater.js`

- [ ] **Step 1: 在文件顶部添加镜像 URL 常量**

```javascript
// ── 国内更新镜像 ──────────────────────────────────────────
const MIRROR_URL = "https://gitee.com/ZephyrTut/excel-tools/raw/release/";
```

Insert after the module-level `let _autoUpdater = null;` line (~line 2), before `getAutoUpdater()`.

- [ ] **Step 2: 重写 `checkForUpdates()` 为双源逻辑**

Replace the existing `checkForUpdates()` function (~line 55-57):

```javascript
/** Check for updates: try domestic mirror first, fall back to GitHub. */
async function checkForUpdates() {
  const updater = getAutoUpdater();
  let lastError = null;

  // ① 尝试 Gitee 镜像（国内直连，无需 VPN）
  try {
    updater.setFeedURL({
      provider: "generic",
      url: MIRROR_URL,
    });
    return await updater.checkForUpdates();
  } catch (err) {
    lastError = err;
    console.warn("[updater] 镜像源检查失败，回退 GitHub:", err.message);
  }

  // ② 回退 GitHub（需要 VPN）
  try {
    updater.setFeedURL({
      provider: "github",
      owner: "ZephyrTut",
      repo: "excel-tools",
    });
    return await updater.checkForUpdates();
  } catch (err) {
    console.warn("[updater] GitHub 检查也失败:", err.message);
    lastError = err;
  }

  throw lastError;
}
```

- [ ] **Step 3: 提交改动**

```bash
git add main/updater.js
git commit -m "feat: add dual-source update check with Gitee mirror fallback"
```

---

### Task 2: 修改 `.github/workflows/release.yml` — 同步到 Gitee

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: 在 upload 步骤之后添加 Gitee 同步步骤**

在文件末尾最后一个 step（`softprops/action-gh-release@v2` 使用 `files:` 上传 assets 之后），追加：

```yaml
      # ── 同步安装包到 Gitee（国内用户免 VPN 更新） ──────────────
      - name: Sync installers to Gitee mirror
        env:
          GITEE_TOKEN: ${{ secrets.GITEE_TOKEN }}
        run: |
          cd dist/installers
          git init
          git checkout -b release
          git config user.name "github-actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "sync ${{ github.ref_name }}"
          git remote add gitee https://oauth2:${GITEE_TOKEN}@gitee.com/ZephyrTut/excel-tools.git
          git push gitee release --force
```

Note: 需要先在 GitHub 仓库配置 `GITEE_TOKEN` secret（见 Task 3）。

- [ ] **Step 2: 提交改动**

```bash
git add .github/workflows/release.yml
git commit -m "ci: sync installers to Gitee release branch for domestic updates"
```

---

### Task 3: 用户手动前置准备

**这部分由用户手动操作，无需代码变更：**

- [ ] **Step 1: 在 Gitee 创建同名空仓库**
  1. 访问 https://gitee.com/new
  2. 创建仓库 `excel-tools`，**不勾选任何初始化选项**（保持空仓库）
  3. 所有者应为 `ZephyrTut`（与 GitHub 用户名一致）

- [ ] **Step 2: 生成 Gitee Token**
  1. 访问 https://gitee.com/profile/personal_access_tokens
  2. 点击"生成新令牌"
  3. 权限范围：勾选 `projects`（写入权限）
  4. 生成后立即复制保存（关闭页面后不再显示）

- [ ] **Step 3: 配置 GitHub Secret**
  1. 访问 GitHub 仓库 → Settings → Secrets and variables → Actions
  2. 点击 "New repository secret"
  3. Name: `GITEE_TOKEN`
  4. Value: 粘贴刚才复制的 Gitee Token
  5. 点击 "Add secret"

---

### 验证清单

| 检查项 | 方法 |
|--------|------|
| Gitee 仓库存在 | 访问 https://gitee.com/ZephyrTut/excel-tools |
| 新版本发布后 release 分支有文件 | 访问 https://gitee.com/ZephyrTut/excel-tools/raw/release/latest.yml |
| 国内机器（无 VPN）能访问 raw 文件 | curl https://gitee.com/ZephyrTut/excel-tools/raw/release/latest.yml |
| CI 同步失败不影响主流程 | 故意给错误 token，确认 GitHub Release 仍正常发布 |
| 双源回退工作 | 在 updater 日志中确认依次尝试了 Gitee → GitHub |
