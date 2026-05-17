/**
 * clean.js — 清理构建产物
 *
 * 在 Windows 上，文件可能被残留的 Electron 进程锁住，
 * 先用 taskkill 杀掉进程，再用 PowerShell 强力删除。
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dirs = [
  "dist/installers",
  "dist/renderer",
  "release",
  "out",
  "dist/win-unpacked",
];

function isWindows() {
  return process.platform === "win32";
}

function killProcesses(names) {
  if (!isWindows()) return;
  for (const name of names) {
    try {
      execSync(`taskkill /f /im "${name}" 2>nul`, { stdio: "pipe" });
    } catch {
      // 进程不存在很正常，忽略
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clean() {
  const root = process.cwd();

  // 1. 杀掉所有可能锁文件的进程
  console.log("🔫 杀掉残留进程 ...");
  killProcesses(["excel-tools.exe", "electron.exe", "node.exe"]);

  // 给进程一个退出的时间窗口
  await sleep(2000);

  // 2. 删除目录
  for (const dir of dirs) {
    const fullPath = path.join(root, dir);
    if (!fs.existsSync(fullPath)) {
      console.log(`  ✓ ${dir} — 不存在，跳过`);
      continue;
    }

    console.log(`  🗑  删除 ${dir} ...`);

    if (isWindows()) {
      // Windows: 用 PowerShell 强力删除（比 fs.rmSync 更暴力）
      try {
        execSync(
          `powershell -Command "Remove-Item -Path '${fullPath}' -Recurse -Force -ErrorAction SilentlyContinue"`,
          { stdio: "pipe", timeout: 10000 }
        );
      } catch (e) {
        // 一次不行再试一次
        console.log(`  ⚠  ${dir} 一次清理未完成，重试 ...`);
        await sleep(2000);
        try {
          execSync(
            `powershell -Command "Remove-Item -Path '${fullPath}' -Recurse -Force -ErrorAction SilentlyContinue"`,
            { stdio: "pipe", timeout: 10000 }
          );
        } catch {
          console.log(`  ⚠  ${dir} 仍无法删除，可能被其他程序占用`);
        }
      }
    } else {
      fs.rmSync(fullPath, { recursive: true, force: true });
    }

    // 验证
    if (fs.existsSync(fullPath)) {
      console.log(`  ⚠  ${dir} 删除后仍存在，请手动检查`);
    } else {
      console.log(`  ✓ ${dir} 已清理`);
    }
  }

  console.log("✅ 清理完成");
}

clean().catch((err) => {
  console.error("清理失败:", err.message);
  process.exit(1);
});
