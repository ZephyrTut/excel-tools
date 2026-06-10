#!/usr/bin/env node
"use strict";

/**
 * generate-changelog.js — 基于 git 标签和提交记录自动生成 CHANGELOG.md
 *
 * 用法:
 *   node scripts/generate-changelog.js              # 输出到控制台
 *   node scripts/generate-changelog.js --write       # 写入 CHANGELOG.md
 *   node scripts/generate-changelog.js --tag v1.2.0  # 从指定标签开始
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function run(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

function getTags() {
  const tags = run("git tag --sort=-version:refname").split("\n").filter(Boolean);
  return tags;
}

function getCommitsBetween(fromTag, toTag) {
  const range = fromTag ? `${fromTag}..${toTag || "HEAD"}` : "";
  if (!range) {
    // 首次：取所有提交
    return run("git log --oneline --no-decorate --format=%H%n%s%n---").split("\n---\n").filter(Boolean).map(parseCommit);
  }
  const raw = run(`git log "${range}" --oneline --no-decorate --format=%H%n%s%n%b%n---`);
  return raw.split("\n---\n").filter(Boolean).map(parseCommit);
}

function parseCommit(block) {
  const lines = block.trim().split("\n");
  const hash = lines[0] || "";
  const subject = lines[1] || "";
  const body = lines.slice(2).filter((l) => l.trim()).join("\n");
  return { hash: hash.slice(0, 7), subject, body };
}

function categorize(commits) {
  const groups = {
    feat: [],
    fix: [],
    refactor: [],
    docs: [],
    test: [],
    build: [],
    chore: [],
    other: [],
  };

  for (const c of commits) {
    const type = (c.subject.match(/^(feat|fix|refactor|docs|test|build|chore)(\(.+\))?:/) || [])[1] || "other";
    if (groups[type]) {
      groups[type].push(c);
    } else {
      groups.other.push(c);
    }
  }

  return groups;
}

const TYPE_LABELS = {
  feat: "🚀 新功能",
  fix: "🐛 Bug 修复",
  refactor: "♻️ 重构",
  docs: "📝 文档",
  test: "✅ 测试",
  build: "📦 构建",
  chore: "🔧 杂项",
  other: "🔹 其他",
};

function formatChangelog(tag, date, commits) {
  const groups = categorize(commits);
  const lines = [`## [${tag}] - ${date}`, ""];

  let hasContent = false;
  for (const [type, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    hasContent = true;
    lines.push(`### ${TYPE_LABELS[type]}`);
    for (const c of items) {
      // 去掉 type: 前缀
      const msg = c.subject.replace(/^(feat|fix|refactor|docs|test|build|chore)(\(.+\))?:\s*/, "");
      lines.push(`- ${msg} (${c.hash})`);
    }
    lines.push("");
  }

  if (!hasContent) {
    lines.push("无显著变更");
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const shouldWrite = args.includes("--write");
  const sinceTag = args.includes("--tag") ? args[args.indexOf("--tag") + 1] : null;

  const tags = getTags();

  if (tags.length === 0) {
    // 没有标签：输出所有提交
    const commits = getCommitsBetween(null, "HEAD");
    const log = formatChangelog("HEAD", new Date().toISOString().slice(0, 10), commits);
    console.log(log);
    return;
  }

  let changelog = "# Changelog\n\n";

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const date = run(`git log -1 --format=%as "${tag}"`) || new Date().toISOString().slice(0, 10);
    const fromTag = i < tags.length - 1 ? tags[i + 1] : null;
    const commits = getCommitsBetween(fromTag, tag);
    changelog += formatChangelog(tag, date, commits) + "\n";
  }

  if (shouldWrite) {
    const outPath = path.join(ROOT, "CHANGELOG.md");
    fs.writeFileSync(outPath, changelog, "utf-8");
    console.log(`✅ CHANGELOG.md 已写入 (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
  } else {
    console.log(changelog);
  }
}

main();
