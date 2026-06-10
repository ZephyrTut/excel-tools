#!/usr/bin/env node
"use strict";

/**
 * upload-python-to-oss.js — 下载嵌入式 Python 并上传到阿里云 OSS 镜像
 *
 * 供国内用户从 OSS 加速下载 Python，避免 python.org 超时。
 *
 * 用法:
 *   node scripts/upload-python-to-oss.js          # 下载 + 上传
 *   node scripts/upload-python-to-oss.js --skip-download  # 仅上传（已有 zip）
 *
 * 环境变量:
 *   OSS_ACCESS_KEY_ID     — 阿里云 OSS AccessKey
 *   OSS_ACCESS_KEY_SECRET — 阿里云 OSS AccessSecret
 *   OSS_BUCKET            — 桶名（默认 excel-tools-release）
 *   OSS_REGION            — 区域（默认 oss-cn-hangzhou）
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const { createWriteStream } = fs;

const ROOT = path.join(__dirname, "..");
const PYTHON_VERSION = "3.12.8";
const PYTHON_ZIP = `python-${PYTHON_VERSION}-embed-amd64.zip`;
const OSS_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/${PYTHON_ZIP}`;
const DEST = path.join(ROOT, "tmp", PYTHON_ZIP);
const OSS_BUCKET = process.env.OSS_BUCKET || "excel-tools-release";
const OSS_REGION = process.env.OSS_REGION || "oss-cn-hangzhou";
const OSS_ENDPOINT = `${OSS_BUCKET}.${OSS_REGION}.aliyuncs.com`;

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    https.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        download(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        const size = fs.statSync(dest).size;
        console.log(`  ✓ 下载完成 (${(size / 1024 / 1024).toFixed(1)} MB)`);
        resolve();
      });
    }).on("error", reject);
  });
}

async function main() {
  const skipDownload = process.argv.includes("--skip-download");

  // 1. 检查 OSS 凭证
  const ak = process.env.OSS_ACCESS_KEY_ID;
  const sk = process.env.OSS_ACCESS_KEY_SECRET;
  if (!ak || !sk) {
    console.error("✗ 请设置 OSS_ACCESS_KEY_ID 和 OSS_ACCESS_KEY_SECRET 环境变量");
    process.exit(1);
  }

  // 2. 下载 Python
  if (skipDownload && fs.existsSync(DEST)) {
    console.log(`📦 使用已有文件: ${DEST}`);
  } else {
    console.log(`📦 下载 Python ${PYTHON_VERSION} embedded ...`);
    if (!fs.existsSync(path.dirname(DEST))) {
      fs.mkdirSync(path.dirname(DEST), { recursive: true });
    }
    await download(OSS_URL, DEST);
  }

  // 3. 下载 ossutil
  const ossutilDir = path.join(ROOT, "tmp", "ossutil");
  const ossutilExe = path.join(ossutilDir, "ossutil.exe");
  if (!fs.existsSync(ossutilExe)) {
    console.log("⚙ 下载 ossutil...");
    if (!fs.existsSync(ossutilDir)) fs.mkdirSync(ossutilDir, { recursive: true });
    const zipPath = path.join(ROOT, "tmp", "ossutil.zip");
    await download(
      "https://gosspublic.alicdn.com/ossutil/1.7.19/ossutil-v1.7.19-windows-amd64.zip",
      zipPath
    );
    execSync(
      `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${ossutilDir}' -Force"`,
      { stdio: "pipe" }
    );
    // Find ossutil exe
    const files = fs.readdirSync(ossutilDir).filter((f) => f.endsWith(".exe"));
    if (files.length > 0) {
      const oldPath = path.join(ossutilDir, files[0]);
      fs.renameSync(oldPath, ossutilExe);
    }
  }

  // 4. 配置 ossutil
  console.log("⚙ 配置 ossutil...");
  execSync(
    `"${ossutilExe}" config -e "${OSS_REGION}.aliyuncs.com" -i "${ak}" -k "${sk}"`,
    { stdio: "inherit" }
  );

  // 5. 上传到 OSS
  const ossTarget = `oss://${OSS_BUCKET}/deps/${PYTHON_ZIP}`;
  console.log(`☁️ 上传到 ${ossTarget} ...`);
  execSync(`"${ossutilExe}" cp "${DEST}" "${ossTarget}" -f`, { stdio: "inherit" });

  console.log(`✅ Python ${PYTHON_VERSION} 已上传到 OSS`);
  console.log(`   URL: https://${OSS_ENDPOINT}/deps/${PYTHON_ZIP}`);
}

main().catch((err) => {
  console.error("❌ 上传失败:", err.message);
  process.exit(1);
});
