/**
 * download-python.js — 下载嵌入式 Python 并为微信发送安装 uiautomation
 *
 * 在 pnpm build 之前执行，将便携 Python 放入 resources/python/
 * 供 wechatController.js 在系统无 Python 时使用。
 *
 * 用法: node scripts/download-python.js
 */

const https = require("node:https");
const http = require("node:http");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { execSync } = require("node:child_process");
const { createWriteStream, existsSync, mkdirSync } = fs;

const ROOT = path.join(__dirname, "..");
const PYTHON_DIR = path.join(ROOT, "resources", "python");
const PYTHON_VERSION = "3.12.8";

// 仅支持 win32 x64
if (process.platform !== "win32" || process.arch !== "x64") {
  console.log("⚠ 非 Windows x64 平台，跳过 Python 下载");
  process.exit(0);
}

async function download(url, dest) {
  const mod = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    mod.get(url, { timeout: 60000 }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败 (HTTP ${res.statusCode}): ${url}`));
        return;
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject).on("timeout", function () { this.destroy(); reject(new Error("下载超时")); });
  });
}

async function main() {
  console.log("📦 设置便携 Python ...");

  // 1. 如果已存在且完整，跳过
  const markerFile = path.join(PYTHON_DIR, ".setup_done");
  if (existsSync(markerFile)) {
    console.log("  ✓ Python 已就绪，跳过");
    return;
  }

  // 2. 清空并创建目录
  if (existsSync(PYTHON_DIR)) {
    fs.rmSync(PYTHON_DIR, { recursive: true, force: true });
  }
  mkdirSync(PYTHON_DIR, { recursive: true });

  const tmpDir = path.join(ROOT, "node_modules", ".python-tmp");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

  const zipUrl = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
  const zipFile = path.join(tmpDir, "python-embed.zip");

  // 3. 下载嵌入式 Python
  console.log(`  ↓ 下载 Python ${PYTHON_VERSION} (embed-amd64) ...`);
  try {
    await download(zipUrl, zipFile);
  } catch (err) {
    console.error(`  ✗ 下载失败: ${err.message}`);
    console.error("  请手动下载并解压到 resources/python/ 目录:");
    console.error(`    ${zipUrl}`);
    console.error("  然后运行: python get-pip.py && pip install uiautomation -t resources/python/");
    process.exit(1);
  }
  console.log("  ✓ 下载完成");

  // 4. 解压
  console.log("  📂 解压中 ...");
  execSync(`powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${PYTHON_DIR}' -Force"`, {
    stdio: "pipe",
    timeout: 30000,
  });
  console.log("  ✓ 解压完成");

  // 5. 修改 _pth 文件以启用 site-packages
  const pthFiles = fs.readdirSync(PYTHON_DIR).filter((f) => f.endsWith("._pth"));
  for (const pthFile of pthFiles) {
    const pthPath = path.join(PYTHON_DIR, pthFile);
    let content = fs.readFileSync(pthPath, "utf-8");
    // 添加 import site 和 Lib/site-packages 支持
    if (!content.includes("import site")) {
      content = content.replace(/#import site/, "import site");
    }
    if (!content.includes("Lib\\site-packages")) {
      content += "Lib\\site-packages\n";
    }
    fs.writeFileSync(pthPath, content, "utf-8");
    console.log(`  ⚙ 已修改 ${pthFile}`);
  }

  const pythonExe = path.join(PYTHON_DIR, "python.exe");
  if (!existsSync(pythonExe)) {
    console.error("  ✗ 未找到 python.exe，解压可能失败");
    process.exit(1);
  }

  // 6. 下载 get-pip.py
  console.log("  ↓ 下载 get-pip.py ...");
  const getPipFile = path.join(tmpDir, "get-pip.py");
  await download("https://bootstrap.pypa.io/get-pip.py", getPipFile);
  console.log("  ✓ get-pip.py 下载完成");

  // 7. 安装 pip
  console.log("  ⚙ 安装 pip ...");
  execSync(`"${pythonExe}" "${getPipFile}" --no-warn-script-location`, {
    stdio: "pipe",
    timeout: 120000,
  });
  console.log("  ✓ pip 安装完成");

  // 8. 安装 uiautomation
  console.log("  ⚙ 安装 uiautomation (用于微信群发送) ...");
  execSync(`"${pythonExe}" -m pip install uiautomation --no-warn-script-location`, {
    stdio: "pipe",
    timeout: 120000,
  });
  console.log("  ✓ uiautomation 安装完成");

  // 9. 写入标记文件
  fs.writeFileSync(markerFile, `Python ${PYTHON_VERSION} embedded with uiautomation\n`, "utf-8");

  // 10. 清理临时文件
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // 11. 统计目录大小
  const size = getDirSize(PYTHON_DIR);
  const sizeMB = (size / 1024 / 1024).toFixed(1);
  console.log(`  ✅ Python 环境就绪 (${sizeMB} MB)`);
}

function getDirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(fullPath);
    } else if (entry.isFile()) {
      total += fs.statSync(fullPath).size;
    }
  }
  return total;
}

main().catch((err) => {
  console.error("❌ Python 设置失败:", err.message);
  process.exit(1);
});
