# Auto-Release Skill — 实施计划

> **For agentic workers:** Use inline execution — single file creation.

**Goal:** 创建 `.reasonix/skills/auto-release/SKILL.md`，一个对话式向导 skill。

**Architecture:** 纯 Reasowix inline skill 文件，Agent 按 skill 内对话脚本逐步引导用户。

**Tech Stack:** Markdown

---

### Task 1: 创建 auto-release SKILL.md

**Files:**
- Create: `.reasonix/skills/auto-release/SKILL.md`

- [ ] **Step 1: 用 install_skill 创建 skill**

skill 内容：5 步对话向导脚本，涵盖项目探测 → 部署选择 → 安装配置 → 手动指引 → 验证总结。

- [ ] **Step 2: 验证 skill 可被 /auto-release 调用**

```bash
cat .reasonix/skills/auto-release/SKILL.md | head -5
```

- [ ] **Step 3: Commit**

```bash
git add .reasonix/skills/auto-release/
git commit -m "feat: add auto-release skill for semantic-release + Pages deployment wizard"
```
