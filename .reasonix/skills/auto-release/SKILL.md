---
name: auto-release
description: Use when a user asks to set up automated release workflows, semantic-release, GitHub Actions CI/CD for publishing, Cloudflare Pages or Vercel deployment, or says "搭自动发布" "自动化发版" " semantic-release 配置". Do NOT use when the project already has a working release pipeline — check first.
---

# Auto-Release — 语义化发布自动化向导

逐步引导从零搭建 `semantic-release` + Pages 部署。**卖现成包不手搓。** 每一步先检查、再询问、再生成。

## ⚠️ 加载后第一步：检查是否真的需要

**在开始任何配置前，先确认这个项目是否需要搭：**

```
□ 是否已有 .github/workflows/release.yml？
□ 是否已有 .releaserc？
□ 是否已有 scripts/release.js？
□ Git tags 是否已有 v1.x.x 格式的版本号？
```

如果以上 3 项以上已存在 → 项目已经有发布体系了。**不要重复搭建**。改为：

> 你的项目已经有完整的发布自动化了。你是想：
> 1. 了解现有流程怎么用？
> 2. 增加新的部署目标（如 Cloudflare Pages）？
> 3. 把现有流程迁移到 semantic-release？
>
> 请说明需求，我来针对性地改。

## 核心原则

- 永远先检查项目状态，再问用户选择，不假设
- 推荐 semantic-release 生态现成插件，不自己写脚本
- 手动步骤给精确 URL 和操作序号
- 只装需要的，不加噪音（commitlint/husky 等不主动推）
- 最后输出检查清单 + 完整流程图

---

## Step 0: 项目状态检查

```
检查清单:
  □ package.json 存在？→ 没有就停止，告知只支持 Node.js 项目
  □ Git 仓库已初始化？→ 没有就 git init
  □ Git remote origin 已配置？→ 没有就停下来让用户先配
  □ 是否已有 .releaserc？→ 有就问覆盖还是跳过
  □ 是否已有 .github/workflows/release.yml？→ 有就问覆盖还是跳过
```

所有检查通过 → 进入 Step 1。

> 你的项目是什么类型？
> 1. **npm 包** — 发布到 npm registry
> 2. **静态站点** — 构建产物是 HTML/JS/CSS
> 3. **其他** — 只发 GitHub Release，不额外发布

根据回答选插件：

| 类型 | 插件 |
|------|------|
| npm 包 | `@semantic-release/npm` |
| 静态站点 | `@semantic-release/git`（推送构建产物） |
| 其他 | 不加发布插件 |

---

## Step 2: 选择部署目标

> 需要自动部署下载页/站点吗？
> 1. **Cloudflare Pages** — 全球 CDN，无带宽费
> 2. **Vercel** — 自动 HTTPS，GitHub 集成
> 3. **跳过** — 只发 GitHub Release

---

## Step 3: 安装依赖

给出一条准确的命令，不推荐无关包：

```bash
# 基础（所有类型都需要）
npm install --save-dev semantic-release @semantic-release/changelog @semantic-release/git @semantic-release/github

# npm 包额外
npm install --save-dev @semantic-release/npm

# 部署 Cloudflare Pages → 用 wrangler CLI（不依赖 Git 集成）
npm install --save-dev wrangler

# 部署 Vercel
npm install --save-dev vercel
```

---

## Step 4: 生成 .releaserc

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      { "changelogFile": "CHANGELOG.md" }
    ],
    "<PUBLISH_PLUGIN>",
    [
      "@semantic-release/git",
      {
        "assets": ["package.json", "CHANGELOG.md"],
        "message": "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

`<PUBLISH_PLUGIN>` 替换规则：
- npm 包 → `"@semantic-release/npm",`
- 静态站点/其他 → 删除这一行

---

## Step 5: 生成 .github/workflows/release.yml

```yaml
name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: write
  id-token: write
  issues: write
  pull-requests: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      # 静态站点需要在这之前加构建步骤
      # - run: npm run build

      - name: Semantic Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npx semantic-release

      # === Cloudflare Pages ===
      - name: Deploy to Cloudflare Pages
        if: success()
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler pages deploy <OUTPUT_DIR> --project-name=<PROJECT_NAME> --branch main

      # === Vercel ===
      # - name: Deploy to Vercel
      #   if: success()
      #   env:
      #     VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      #     VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      #     VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      #   run: npx vercel deploy --prod --token=$VERCEL_TOKEN
```

根据部署选择，删除不用的部署步骤，替换 `<OUTPUT_DIR>` 和 `<PROJECT_NAME>`。

---

## Step 6: 手动配置指引

### Cloudflare Pages（wrangler CLI 方式）

> ⚠️ 去 Cloudflare 网页操作：
>
> **创建 API Token：**
> 1. 打开 https://dash.cloudflare.com/profile/api-tokens
> 2. 点击「创建令牌」→「自定义令牌」
> 3. 权限：Account → Cloudflare Pages → 编辑
> 4. 账户资源：所有账户
> 5. 复制 token
>
> **获取 Account ID：**
> 1. 打开 https://dash.cloudflare.com
> 2. 右侧「API」→ 复制「账户 ID」
>
> **添加到 GitHub Secrets：**
> 1. 打开 `https://github.com/<owner>/<repo>/settings/secrets/actions`
> 2. New repository secret：
>    - Name: `CLOUDFLARE_API_TOKEN`, Value: token
>    - Name: `CLOUDFLARE_ACCOUNT_ID`, Value: 账户 ID
>
> **首次创建 Pages 项目：**
> ```bash
> npx wrangler pages project create <project-name> --production-branch main
> ```
>
> 完成后回复「done」

### Vercel

> ⚠️ 去 Vercel 网页操作：
>
> **获取 Token：**
> 1. 打开 https://vercel.com/account/tokens
> 2. Create Token → 名称填 `github-actions`，Scope 选 Full Account
> 3. 复制 token
>
> **获取 Project ID 和 Org ID：**
> ```bash
> npx vercel link
> cat .vercel/project.json  # 记下 projectId 和 orgId
> ```
>
> **添加到 GitHub Secrets：**
> 1. `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`
>
> 完成后回复「done」

---

## Step 7: 验证清单

全部完成后，逐项确认：

```
□ package.json devDependencies 有 semantic-release
□ .releaserc 存在且插件链正确
□ .github/workflows/release.yml 存在
□ GitHub Actions permissions 设为 Read and write（Settings > Actions > General）
□ GitHub Secrets 已添加（如 CLOUDFLARE_API_TOKEN）
□ 项目已推送到 GitHub（git push origin main）
```

---

## 最终总结

```
🎉 自动化发布已就绪！

  推送代码到 main
    ↓
  GitHub Actions 自动运行
    ↓
  semantic-release:
    ├─ 分析 commit → 算版本号
    ├─ 生成 CHANGELOG.md
    ├─ 创建 Git tag + GitHub Release
    └─ 部署到 <Cloudflare Pages / Vercel>

提交规范
  feat: 新功能    → minor (1.2.0 → 1.3.0)
  fix:  Bug 修复  → patch (1.2.0 → 1.2.1)
  feat!: 不兼容   → major (1.2.0 → 2.0.0)
  或 commit body 含 BREAKING CHANGE

触发发布
  git add . && git commit -m "feat: xxx" && git push
```

---

## 常见问题

| 问题 | 修复 |
|------|------|
| push 后没触发 | 检查分支名必须是 `main`，workflow 文件在 `.github/workflows/` |
| permission denied | Settings > Actions > General > Workflow permissions → Read and write |
| npm publish 401 | 添加 `NPM_TOKEN` 到 GitHub Secrets，`.releaserc` 里保留 `@semantic-release/npm` |
| Cloudflare 部署失败 | 确认 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID` 两个 secret 都已添加 |
| `npm ci` 失败 | 确认 `package-lock.json` 已提交到 Git |
