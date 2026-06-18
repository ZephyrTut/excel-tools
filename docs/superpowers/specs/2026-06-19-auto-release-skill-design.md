# Auto-Release Skill — 设计文档

> 日期：2026-06-19 · 状态：已批准

## 目标

创建一个可跨项目复用的 Reasonix skill（`auto-release`），以**对话式向导**方式帮用户从零搭建语义化发布自动化流程。

## Skill 形态

纯 skill 指令流（方案 A）—— Agent 按 skill 文件里的对话脚本逐步引导用户，现场生成配置文件，不依赖外部模板仓库。

## 核心流程

```
/auto-release
  ↓
Step 1: 探测项目类型
  → 检查 package.json、现有 CI、Git 仓库状态
  → 问：npm 包 / 静态站点 / 其他？
  ↓
Step 2: 选择部署目标
  → 问：Cloudflare Pages / Vercel / 跳过？
  ↓
Step 3: 安装 & 配置
  → npm install -D semantic-release @semantic-release/changelog @semantic-release/git
  → 生成 .releaserc（按项目类型选择插件）
  → 生成 .github/workflows/release.yml
  ↓
Step 4: 手动配置指引
  → Cloudflare 创建 API token（带截图级指引）
  → Vercel 创建 token（带截图级指引）
  → GitHub Secrets 添加 token
  ↓
Step 5: 验证 & 总结
  → 推送 tag 触发 CI 验证
  → 输出完整自动化流程图
  → 后续建议
```

## 对话分支逻辑

```
项目类型？
  ├─ npm 包       → @semantic-release/npm
  ├─ 静态站点      → @semantic-release/git（推送构建产物）
  └─ 其他          → 只发 GitHub Release

部署目标？
  ├─ Cloudflare Pages  → wrangler pages deploy + CF_API_TOKEN + CF_ACCOUNT_ID
  ├─ Vercel            → vercel deploy --prod + VERCEL_TOKEN + VERCEL_ORG_ID + VERCEL_PROJECT_ID
  └─ 跳过              → 只发 GitHub Release
```

## 不做的事（第一版）

- ❌ Electron 构建（场景太窄，用户可后续自行添加）
- ❌ OSS 镜像上传（国内镜像场景，后续扩展）
- ❌ 人工提炼更新日志（走全自动 semantic-release）

## 设计原则

1. **卖现成包不手搓**：优先推荐 semantic-release 生态插件，不自己写脚本
2. **新手友好**：每个手动步骤给明确 URL 和操作步骤
3. **可扩展**：对话分支用 `if/else` 结构，后续加目标只需加一个分支
4. **跨项目**：不依赖本项目特有结构（无 Electron、无 hardcoded 路径）

## 输出物

一个 skill 文件：`.reasonix/skills/auto-release/SKILL.md`
