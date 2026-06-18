---
name: auto-release
description: Conversational wizard for setting up semantic-release + Cloudflare Pages or Vercel deployment automation. Beginner-friendly with guided prompts.
---

# Auto-Release — 语义化发布自动化向导

逐步引导用户从零搭建 `semantic-release` + Pages 部署的完整自动化发布流程。**优先推荐现成包，不手搓脚本。新手友好，每一步给明确指引。**

---

## Step 1: 探测项目上下文

在开始任何配置前，先检查用户项目的当前状态：

```
检查项:
  - package.json 是否存在？项目名、版本号？
  - Git 仓库状态：是否初始化？remote origin 是否配置？
  - 是否已有 .github/workflows/ 目录？
  - 是否已有 .releaserc / release.config.js？
```

**如果 package.json 不存在**：这不是 Node.js 项目，停止并告知用户目前只支持 Node.js 项目。

**如果 Git remote 未配置**：提示用户先 `git remote add origin <url>`。

**如果已有 .releaserc**：告知用户已有配置，询问是覆盖还是跳过。

---

## Step 2: 确定项目类型

询问用户：

> 你的项目是什么类型？
> 1. **npm 包** — 发布到 npm registry（如 React 组件库、CLI 工具）
> 2. **静态站点** — 构建后是 HTML/JS/CSS（如文档站、SPA）
> 3. **其他** — 只发 GitHub Release，不额外发布

根据回答：

| 类型 | 额外插件 | 说明 |
|------|---------|------|
| npm 包 | `@semantic-release/npm` | 自动 `npm publish` |
| 静态站点 | `@semantic-release/git` | 推送构建产物到 Git |
| 其他 | 无 | 只创建 tag + GitHub Release |

---

## Step 3: 选择部署目标

> 你需要一个下载页/静态站点自动部署吗？
> 1. **Cloudflare Pages** — 全球 CDN，国内需翻墙
> 2. **Vercel** — 自动 HTTPS，GitHub 集成好
> 3. **跳过** — 只发 GitHub Release

---

## Step 4: 安装依赖

根据用户选择，给出准确的安装命令：

```bash
# 基础（所有类型都需要）
npm install --save-dev semantic-release @semantic-release/changelog @semantic-release/git

# npm 包额外
npm install --save-dev @semantic-release/npm

# 部署到 Cloudflare Pages
npm install --save-dev wrangler

# 部署到 Vercel
npm install --save-dev vercel
```

---

## Step 5: 生成配置文件

### 5a. `.releaserc`

根据项目类型生成。以下是 npm 包 + Cloudflare Pages 的示例：

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
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

**静态站点**去掉 `@semantic-release/npm`，**其他**只保留前三个 + `@semantic-release/github`。

### 5b. `.github/workflows/release.yml`

生成完整的 GitHub Actions 工作流。以下模板支持 Cloudflare Pages：

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

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      # 如果是静态站点，在这之前加构建步骤
      # - run: npm run build

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: npx semantic-release

      # === Cloudflare Pages（可选） ===
      - name: Deploy to Cloudflare Pages
        if: success()
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        run: npx wrangler pages deploy ./dist --project-name=<project-name> --branch main

      # === Vercel（可选） ===
      # - name: Deploy to Vercel
      #   if: success()
      #   env:
      #     VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
      #     VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
      #     VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
      #   run: npx vercel deploy --prod --token=$VERCEL_TOKEN
```

---

## Step 6: 手动配置指引

### Cloudflare Pages

> ⚠️ 现在需要你去 Cloudflare 网页操作：
>
> **创建 API Token：**
> 1. 打开 https://dash.cloudflare.com/profile/api-tokens
> 2. 点击「创建令牌」→ 选「自定义令牌」
> 3. 权限设置：Account → Cloudflare Pages → 编辑
> 4. 账户资源：所有账户
> 5. 点击「继续以显示摘要」→ 复制 token
>
> **获取 Account ID：**
> 1. 打开 https://dash.cloudflare.com
> 2. 右侧「API」区域 → 复制「账户 ID」
>
> **添加到 GitHub Secrets：**
> 1. 打开 `https://github.com/<owner>/<repo>/settings/secrets/actions`
> 2. 点击「New repository secret」
> 3. 分别添加：
>    - Name: `CLOUDFLARE_API_TOKEN`, Value: 你复制的 token
>    - Name: `CLOUDFLARE_ACCOUNT_ID`, Value: 你复制的 Account ID
>
> 完成后回复「done」

### Vercel

> ⚠️ 现在需要你去 Vercel 网页操作：
>
> **获取 Token：**
> 1. 打开 https://vercel.com/account/tokens
> 2. 点击「Create Token」
> 3. 输入名称（如 `github-actions`），Scope 选「Full Account」
> 4. 复制 token
>
> **获取 Project ID 和 Org ID：**
> ```bash
> npx vercel link   # 关联项目
> npx vercel env ls # 查看 .vercel/project.json 里的 projectId 和 orgId
> ```
>
> **添加到 GitHub Secrets：**
> 1. 打开 `https://github.com/<owner>/<repo>/settings/secrets/actions`
> 2. 分别添加：`VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`
>
> 完成后回复「done」

---

## Step 7: 验证 & 总结

确认所有步骤完成后，**不要立即推送**。先帮用户检查：

```
✅ package.json 有 semantic-release 依赖
✅ .releaserc 配置正确
✅ .github/workflows/release.yml 已创建
✅ GitHub Secrets 已配置
✅ 项目有 remote origin
```

然后输出最终总结：

```
## 🎉 自动化发布已配置完成！

### 你的自动化流程

  代码 push 到 main 分支
    ↓
  GitHub Actions 自动运行
    ↓
  semantic-release:
    ├─ 分析 commit message 算版本号
    ├─ 生成 CHANGELOG.md
    ├─ 创建 Git tag + GitHub Release
    └─ 部署到 <Cloudflare Pages / Vercel>

### 提交规范

每次 commit 请遵循 Conventional Commits:

  feat: 新功能        → minor 版本 (1.2.0 → 1.3.0)
  fix:  Bug 修复      → patch 版本 (1.2.0 → 1.2.1)
  perf: 性能优化 (含 BREAKING CHANGE) → major 版本 (1.2.0 → 2.0.0)

### 触发发布

  git add . && git commit -m "feat: 新增用户登录功能" && git push

就这么简单。每次 push 后去 GitHub Actions 看进度。

### 后续建议

  - 在 VSCode 装 Git Lens，用 AI 生成中文 commit message
  - 工具推荐：commitizen（交互式写 commit）+ commitlint（CI 检查格式）
  - 要加 OSS 镜像部署？重新运行 /auto-release 选跳过部署，手动参考文档
```
