const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execSync } = require("child_process");

const PACKAGE_PATH = path.join(__dirname, "..", "package.json");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
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
  console.log(`     v${current} → v${formatVersion({ ...v, patch: v.patch + 1 })}`);
  console.log("  2) 中版本 (minor) — 新增功能，向下兼容");
  console.log(`     v${current} → v${formatVersion({ major: v.major, minor: v.minor + 1, patch: 0 })}`);
  console.log("  3) 大版本 (major) — 不兼容的重大改动");
  console.log(`     v${current} → v${formatVersion({ major: v.major + 1, minor: 0, patch: 0 })}`);

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

  // 2. Update package.json
  pkg.version = newVersion;
  fs.writeFileSync(PACKAGE_PATH, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`✓ package.json 已更新: ${newVersion}`);

  // 3. Git commit, tag, push
  try {
    execSync("git add package.json", { stdio: "inherit" });
    execSync(`git commit -m "release: ${tag}"`, { stdio: "inherit" });
    execSync(`git tag ${tag}`, { stdio: "inherit" });
    console.log(`✓ 本地 tag ${tag} 已创建`);
    execSync(`git push origin main --tags`, { stdio: "inherit" });
    console.log(`✓ 已推送到 GitHub，CI 将自动构建`);
  } catch (err) {
    console.error("推送失败:", err.message);
    console.log("请手动执行: git push origin main --tags");
  }

  rl.close();
}

main();
