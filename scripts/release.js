const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");

const PACKAGE_PATH = path.join(__dirname, "..", "package.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function parseVersion(ver) {
  const parts = ver.split(".").map(Number);
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function formatVersion(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

async function main() {
  // 1. Read current version
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, "utf-8"));
  const current = pkg.version;
  const v = parseVersion(current);

  console.log(`\n当前版本: v${current}\n`);
  console.log("请选择更新类型:");
  console.log("  1) 小版本 (patch) — 修复bug，不兼容改动无");
  console.log(
    `     v${current} → v${formatVersion({ ...v, patch: v.patch + 1 })}`
  );
  console.log("  2) 中版本 (minor) — 新增功能，向下兼容");
  console.log(
    `     v${current} → v${formatVersion({
      major: v.major,
      minor: v.minor + 1,
      patch: 0,
    })}`
  );
  console.log("  3) 大版本 (major) — 不兼容的重大改动");
  console.log(
    `     v${current} → v${formatVersion({
      major: v.major + 1,
      minor: 0,
      patch: 0,
    })}`
  );

  const choice = await ask("\n输入 1/2/3: ");

  let next;
  switch (choice.trim()) {
    case "1":
      next = { major: v.major, minor: v.minor, patch: v.patch + 1 };
      break;
    case "2":
      next = { major: v.major, minor: v.minor + 1, patch: 0 };
      break;
    case "3":
      next = { major: v.major + 1, minor: 0, patch: 0 };
      break;
    default:
      console.log("无效输入，退出");
      rl.close();
      process.exit(1);
  }

  const newVersion = formatVersion(next);
  const tag = `v${newVersion}`;

  console.log(`\n新版本: v${current} → ${tag}`);

  const confirm = await ask("确认发布？(y/N): ");
  if (confirm.trim().toLowerCase() !== "y") {
    console.log("已取消");
    rl.close();
    process.exit(0);
  }

  // 2.5. 展示提交列表，等待用户提炼更新日志
  const lastTag = (() => {
    try {
      return execSync("git describe --tags --abbrev=0", { encoding: "utf-8" }).trim();
    } catch {
      return null;
    }
  })();

  if (lastTag) {
    try {
      const log = execSync(`git log ${lastTag}..HEAD --oneline --no-decorate`, { encoding: "utf-8" }).trim();
      if (log) {
        const lines = log.split("\n");
        const newest = lines[0];
        const oldest = lines[lines.length - 1];
        console.log(`\n📋 自 ${lastTag} 以来的提交范围:\n`);
        if (lines.length === 1) {
          console.log(`  ${newest}`);
        } else {
          console.log(`  最新: ${newest}`);
          console.log(`  最旧: ${oldest}`);
          console.log(`  (共 ${lines.length} 个提交)`);
        }
      }
    } catch {
      console.log("  (无法获取提交列表)");
    }
  } else {
    try {
      const log = execSync("git log --oneline --no-decorate", { encoding: "utf-8" }).trim();
      if (log) {
        const lines = log.split("\n");
        const newest = lines[0];
        const oldest = lines[lines.length - 1];
        console.log(`\n📋 首次发布，提交范围:\n`);
        if (lines.length === 1) {
          console.log(`  ${newest}`);
        } else {
          console.log(`  最新: ${newest}`);
          console.log(`  最旧: ${oldest}`);
          console.log(`  (共 ${lines.length} 个提交)`);
        }
      }
    } catch {
      console.log("  (无法获取提交列表)");
    }
  }

  rl.close();
  const releaseNotes = await new Promise((resolve) => {
    const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
    const lines = [];
    let blankCount = 0;
    console.log("\n输入更新日志（贴入后按 Enter 两次结束）:");
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

  if (!releaseNotes) {
    console.log("更新日志为空，退出");
    process.exit(1);
  }

  // 2. Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`✓ package.json 已更新: ${newVersion}`);

  // 3. 写入 CHANGELOG.md
  const CHANGELOG_PATH = path.join(__dirname, "..", "CHANGELOG.md");
  const date = new Date().toISOString().slice(0, 10);
  const newSection = `## [${tag}] - ${date}\n\n${releaseNotes}\n\n`;

  try {
    let existing = "";
    try {
      existing = fs.readFileSync(CHANGELOG_PATH, "utf-8");
    } catch {
      existing = "# Changelog\n\n";
    }

    // 插入到标题行之后 (fallback: 文件无空行时追加在末尾)
    let newChangelog;
    const headerEnd = existing.indexOf("\n\n");
    if (headerEnd === -1) {
      newChangelog = existing.trimEnd() + "\n\n" + newSection;
    } else {
      const header = existing.slice(0, headerEnd + 2);
      const body = existing.slice(headerEnd + 2);
      newChangelog = header + newSection + body;
    }

    fs.writeFileSync(CHANGELOG_PATH, newChangelog);
    console.log(`✓ CHANGELOG.md 已更新: ${tag}`);
  } catch (err) {
    console.warn("⚠ CHANGELOG 写入失败:", err.message);
  }

  // 4. Git commit, tag, push
  try {
    execSync(`git add package.json CHANGELOG.md`, { stdio: "inherit" });
    execSync(`git commit -m "release: ${tag}"`, { stdio: "inherit" });
    execSync(`git tag ${tag}`, { stdio: "inherit" });
    console.log(`✓ 本地 tag ${tag} 已创建`);
    execSync(`git push origin main`, { stdio: "inherit" });
    execSync(`git push origin ${tag}`, { stdio: "inherit" });
    console.log(`✓ tag ${tag} 已推送，CI 将自动构建`);
  } catch (err) {
    console.error("推送失败:", err.message);
    console.log("请手动执行: git push origin main --tags");
  }

  rl.close();
}

main();
