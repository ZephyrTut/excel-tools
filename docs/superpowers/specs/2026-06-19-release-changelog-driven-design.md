# 发布流程重构 — CHANGELOG.md 驱动发布日志

> 日期：2026-06-19 · 状态：待审批

## 目标

用人工提炼的更新日志替换自动生成的 CHANGELOG，CHANGELOG.md 作为 GitHub Release 和 Cloudflare Pages 的唯一数据源。

## 现状

```
release.js → generate-changelog.js (auto from git log) → CHANGELOG.md
CI: gh release view <ver> --json body → Cloudflare Pages HTML
```

- CHANGELOG 是 conventional commit 摘要，不可读
- GitHub Release body 和 Cloudflare Pages 各取各的，不是同一来源

## 目标流程

```
release.js
  ├─ 计算新版本号
  ├─ 打印 git log <last-tag>..HEAD --oneline
  ├─ ⏸ 暂停，等待用户粘贴提炼后的更新日志
  ├─ 将提炼文本插入 CHANGELOG.md 顶部（## [vX.Y.Z] 格式）
  └─ git commit "release: vX.Y.Z" + tag + push

CI (release.yml)
  ├─ GitHub Release body ← 读取 CHANGELOG.md 当前版本段落
  └─ Cloudflare Pages ← 解析 CHANGELOG.md 所有版本段落渲染 HTML
```

## release.js 改动

| 步骤 | 现在 | 改为 |
|------|------|------|
| 展示提交列表 | 无 | `git log <last-tag>..HEAD --oneline` |
| 更新日志来源 | 调用 generate-changelog.js | 暂停等用户粘贴 |
| 写入 CHANGELOG | 覆盖 | 新版本段落插入顶部 |
| generate-changelog.js | 每次调用 | 不再调用，保留备用 |

## release.yml 改动

**GitHub Release 步骤：**
- body_path 指向临时文件，内容从 CHANGELOG.md 提取当前版本段落
- 移除 softprops 的 generate_release_notes: false 已是对的

**Cloudflare Pages 步骤：**
- 不再 gh release view 逐版查 API
- 改为解析仓库中 CHANGELOG.md 的 `## [vX.Y.Z]` 段落
- 每个版本：下载链接 + `<details>` 折叠更新内容

## CHANGELOG.md 格式约定

```markdown
# Changelog

## [v1.3.0] - 2026-06-19

- 新增 xxx 功能
- 修复 yyy 问题
- 优化 zzz 体验

## [v1.2.7] - 2026-06-10
...
```

## 不改的部分

- `generate-changelog.js` 保留不删，可能未来备用
- `release.js` 版本号选择逻辑不变
- git tag / push 逻辑不变

## 影响范围

| 文件 | 改动 |
|------|------|
| `scripts/release.js` | +展示提交列表 +暂停等输入 +写入 CHANGELOG（替换 generate-changelog 调用） |
| `.github/workflows/release.yml` | GitHub Release body 读取 CHANGELOG.md，Cloudflare Pages 解析 CHANGELOG.md |
| `scripts/generate-changelog.js` | 不改 |

## 风险

低。CHANGELOG.md 格式约定简单，CI 解析逻辑明确。失败回退：手动改 CHANGELOG.md 再重新 push tag。
