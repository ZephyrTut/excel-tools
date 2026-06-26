"use strict";
const { execFile, execSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { promisify } = require("node:util");
const https = require("node:https");
const http = require("node:http");
const { URL } = require("node:url");
const { createWriteStream } = fs;

const execFileAsync = promisify(execFile);

const PYTHON_VERSION = "3.12.8";

// 下载源列表（按优先级：国内镜像优先，官方回退）
const PYTHON_EMBED_URLS = [
  // 1. 项目 OSS 镜像（国内最快）
  `https://excel-tools-release.oss-cn-hangzhou.aliyuncs.com/deps/python-${PYTHON_VERSION}-embed-amd64.zip`,
  // 2. npmmirror 二进制镜像（国内备用）
  `https://registry.npmmirror.com/-/binary/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`,
  // 3. 官方源（海外回退）
  `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`,
];

// ── Python 检测（模块级缓存） ─────────────────────────────────────

let _pythonCommand = null;
let _pythonChecked = false;

const PYTHON_CANDIDATES = ["python", "python3", "py -3", "py"];

/**
 * 获取打包在 resources 中的便携 Python 路径
 * 开发环境: resources/python/python.exe
 * 生产环境: process.resourcesPath/python/python.exe
 */
function getBundledPythonPath() {
  const resourcesPath =
    process.resourcesPath || path.join(__dirname, "..", "..", "resources");
  const exePath = path.join(resourcesPath, "python", "python.exe");
  return fs.existsSync(exePath) ? exePath : null;
}

/**
 * 获取打包在 resources 中的便携 Python 路径
 */
function getUserPythonPath(userDataDir) {
  if (!userDataDir) return null;
  const exePath = path.join(userDataDir, "python", "python.exe");
  return fs.existsSync(exePath) ? exePath : null;
}

/**
 * 检测可用的 Python 命令
 * @param {string} [userDataDir] - 用户数据目录，用于查找自动下载的 Python
 * @returns {Promise<string|null>}
 */
async function findPython(userDataDir) {
  if (_pythonChecked && !userDataDir) return _pythonCommand;

  // 1. 优先使用打包的便携 Python
  const bundled = getBundledPythonPath();
  if (bundled) {
    try {
      const { stdout } = await execFileAsync(bundled, ["--version"], {
        timeout: 3000,
      });
      if (stdout && stdout.toLowerCase().includes("python")) {
        _pythonCommand = bundled;
        _pythonChecked = true;
        return _pythonCommand;
      }
    } catch {
      // 打包的 Python 不可用，继续
    }
  }

  // 2. 检查用户目录下的自动安装 Python
  if (userDataDir) {
    const userPython = getUserPythonPath(userDataDir);
    if (userPython) {
      try {
        const { stdout } = await execFileAsync(userPython, ["--version"], {
          timeout: 3000,
        });
        if (stdout && stdout.toLowerCase().includes("python")) {
          _pythonCommand = userPython;
          _pythonChecked = true;
          return _pythonCommand;
        }
      } catch {
        // 用户目录的 Python 损坏，继续
      }
    }
  }

  // 3. 回退到系统 Python
  for (const cmd of PYTHON_CANDIDATES) {
    try {
      const [prog, ...args] = cmd.split(" ");
      const { stdout } = await execFileAsync(prog, [...args, "--version"], {
        timeout: 3000,
      });
      if (stdout && stdout.toLowerCase().includes("python")) {
        _pythonCommand = cmd;
        _pythonChecked = true;
        return _pythonCommand;
      }
    } catch {
      continue;
    }
  }

  _pythonChecked = true;
  _pythonCommand = null;
  return null;
}

/**
 * 强制重新检测 Python
 */
function resetPythonCheck() {
  _pythonChecked = false;
  _pythonCommand = null;
}

// ── 辅助 ──────────────────────────────────────────────────────────

/**
 * 从可能混杂了其他内容的 stdout 中提取 JSON 对象
 * 优先尝试整体解析，失败后尝试正则匹配最后一个完整 JSON 对象
 */
function extractJsonFromOutput(stdout) {
  const trimmed = stdout.trim();
  // 优先直接解析
  try {
    return JSON.parse(trimmed);
  } catch {
    // 尝试按行找最后一行 JSON
    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i].trim());
        if (obj && typeof obj === "object") return obj;
      } catch { /* continue */ }
    }
    // 最后尝试正则提取
    const jsonMatch = trimmed.match(/\{[\s\S]*"success"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch { /* give up */ }
    }
    return null;
  }
}

// ── 微信发送 ──────────────────────────────────────────────────────

/**
 * 通过 Python wx4py 脚本发送文件到微信群（UIA 操控）
 * @param {string} groupName - 微信群名称
 * @param {string} filePath - 文件绝对路径
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendToWechatGroup(groupName, filePath, signal) {
  const pythonCmd = await findPython();
  if (!pythonCmd) {
    return {
      success: false,
      error:
        "未检测到 Python 环境，请安装 Python 3 后重试（https://www.python.org/downloads/）",
    };
  }

  const scriptPath = path.join(__dirname, "wechat_sender_wx4.py");

  let stdout = "";
  try {
      const [prog, ...args] = pythonCmd.split(" ");
      const result = await execFileAsync(
        prog,
        [...args, scriptPath, "--group", groupName, "--file", filePath],
        { timeout: 60000 }
      );
      stdout = result.stdout || "";

      const parsed = extractJsonFromOutput(stdout);
      if (parsed) return parsed;

      console.warn("[wechatController] 无法解析 Python 输出:", stdout.substring(0, 500));
      return { success: false, error: "微信发送异常，请重试" };
    } catch (err) {
      // 因为不再向 execFile 传 signal，这里的 AbortError 仅来自外部信号（极少见）
      if (err.name === "AbortError") return { success: false, error: "发送已取消" };

      stdout = err.stdout || stdout;
      if (stdout) {
        const parsed = extractJsonFromOutput(stdout);
        if (parsed && parsed.error) return { success: false, error: parsed.error };
      }

      if (err.killed || (err.message || "").includes("timeout")) {
        return { success: false, error: "微信发送超时，请确认微信已打开且窗口可见" };
      }

      console.warn("[wechatController] 微信发送失败:", err.message);
      return { success: false, error: "微信发送失败，请确认微信已登录且窗口可见" };
    }
}

/**
 * 检测 wx4py 包是否已安装
 * @param {string} pythonCmd - Python 命令或路径
 * @returns {Promise<boolean>}
 */
async function checkWx4pyInstalled(pythonCmd) {
  if (!pythonCmd) return false;
  try {
    const [prog, ...args] = pythonCmd.split(" ");
    const { stdout } = await execFileAsync(
      prog,
      [...args, "-c", "from wx4py import WeChatClient; print('OK')"],
      { timeout: 10000 }
    );
    return stdout.trim() === "OK";
  } catch {
    return false;
  }
}

/**
 * 自动安装 wx4py 到指定的 Python 环境
 * @param {string} pythonCmd - Python 命令或路径
 * @returns {Promise<boolean>}
 */
async function ensureWx4pyInstalled(pythonCmd) {
  if (!pythonCmd) return false;
  // 先检查是否已安装
  const installed = await checkWx4pyInstalled(pythonCmd);
  if (installed) return true;

  try {
    const [prog, ...args] = pythonCmd.split(" ");
    await execFileAsync(prog, [...args, "-m", "pip", "install", "wx4py"], {
      timeout: 120000,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 确保嵌入式 Python 的 ._pth 文件已正确配置（import site 解注释 + Lib\site-packages）
 * 幂等操作：已配置好的不会重复修改
 * @param {string} pythonDir - Python 安装目录
 */
function ensurePthConfigured(pythonDir) {
  const pthFiles = fs.readdirSync(pythonDir).filter((f) => f.endsWith("._pth"));
  for (const pthFile of pthFiles) {
    const pthPath = path.join(pythonDir, pthFile);
    let content = fs.readFileSync(pthPath, "utf-8");
    // 用行级正则匹配：已存在未注释的 import site 才跳过
    if (!/^import site$/m.test(content)) {
      content = content.replace(/^#import site$/m, "import site");
    }
    if (!content.includes("Lib\\site-packages")) {
      content += "Lib\\site-packages\n";
    }
    fs.writeFileSync(pthPath, content, "utf-8");
  }
}

/**
 * 自动下载嵌入式 Python 到指定目录，并安装 pip + wx4py
 * @param {string} destDir - 目标目录（如 app.getPath("userData")）
 * @param {function} [onProgress] - ({ percent: number, message: string }) => void
 * @returns {Promise<boolean>}
 */
async function autoInstallPython(destDir, onProgress) {
  if (!destDir) return false;
  const prog = (p, msg) => { if (typeof onProgress === "function") onProgress({ percent: p, message: msg }); };

  const pythonDir = path.join(destDir, "python");

  // 如果已经安装过，验证可用性并修复 ._pth 后直接返回
  const installed = getUserPythonPath(destDir);
  if (installed) {
    try {
      const { stdout } = await execFileAsync(installed, ["--version"], { timeout: 3000 });
      if (stdout && stdout.toLowerCase().includes("python")) {
        // 升级场景：已有 Python 但 ._pth 可能未修复（旧版本 bug）
        ensurePthConfigured(pythonDir);
        return true;
      }
    } catch { /* 损坏，重新安装 */ }
  }

  prog(0, "准备安装 Python 环境...");

  // 清空并创建目录
  if (fs.existsSync(pythonDir)) {
    fs.rmSync(pythonDir, { recursive: true, force: true });
  }
  fs.mkdirSync(pythonDir, { recursive: true });

  const tmpDir = path.join(destDir, ".python-tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const zipFile = path.join(tmpDir, "python-embed.zip");

  // 多源下载（OSS 镜像 → npmmirror → 官方）
  let downloaded = false;
  let lastError = null;
  for (const url of PYTHON_EMBED_URLS) {
    prog(5, `正在下载 Python (${new URL(url).hostname})...`);
    try {
      await downloadFile(url, zipFile, (pct) => {
        prog(5 + Math.round(pct * 0.4), `正在下载 Python... ${pct}%`);
      });
      downloaded = true;
      break;
    } catch (err) {
      lastError = err;
      prog(5, `下载失败，尝试下一个镜像...`);
    }
  }

  if (!downloaded) {
    prog(0, `下载 Python 失败: ${lastError ? lastError.message : '所有镜像均不可用'}`);
    return false;
  }

  prog(50, "正在解压...");
  try {
    execSync(`powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${pythonDir}' -Force"`, {
      timeout: 30000,
    });
  } catch {
    prog(0, "解压失败");
    return false;
  }

  // 修改 _pth 文件启用 site-packages（幂等，复用升级路径同一逻辑）
  ensurePthConfigured(pythonDir);

  const pythonExe = path.join(pythonDir, "python.exe");
  if (!fs.existsSync(pythonExe)) {
    prog(0, "未找到 python.exe，解压可能失败");
    return false;
  }

  // 安装 pip
  prog(55, "正在安装 pip...");
  const getPipFile = path.join(tmpDir, "get-pip.py");
  try {
    await downloadFile("https://bootstrap.pypa.io/get-pip.py", getPipFile, (pct) => {
      prog(55 + Math.round(pct * 0.15), "正在下载 pip...");
    });
    execSync(`"${pythonExe}" "${getPipFile}" --no-warn-script-location`, {
      timeout: 120000,
    });
  } catch (err) {
    prog(0, `pip 安装失败: ${err.message}`);
    return false;
  }

  // 安装 wx4py（微信 UIA 自动化库）
  prog(75, "正在安装 wx4py...");
  try {
    execSync(`"${pythonExe}" -m pip install wx4py --no-warn-script-location`, {
      timeout: 120000,
    });
  } catch (err) {
    prog(0, `wx4py 安装失败: ${err.message}`);
    return false;
  }

  // 标记完成
  const markerFile = path.join(pythonDir, ".setup_done");
  fs.writeFileSync(markerFile, `Python ${PYTHON_VERSION} embedded with wx4py\n`, "utf-8");
  fs.rmSync(tmpDir, { recursive: true, force: true });

  prog(100, "Python + wx4py 安装完成");
  return true;
}

/**
 * 下载文件（支持进度回调）
 * @param {string} url
 * @param {string} dest
 * @param {function} [onProgress] - (percent: number) => void
 * @returns {Promise<void>}
 */
function downloadFile(url, dest, onProgress) {
  const mod = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    mod.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let received = 0;
      const file = createWriteStream(dest);
      res.on("data", (chunk) => {
        received += chunk.length;
        if (total > 0 && typeof onProgress === "function") {
          onProgress(Math.min(99, Math.round((received / total) * 100)));
        }
      });
      res.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", reject).on("timeout", function () { this.destroy(); reject(new Error("下载超时")); });
  });
}

module.exports = { sendToWechatGroup, findPython, resetPythonCheck, getBundledPythonPath, checkWx4pyInstalled, ensureWx4pyInstalled, getUserPythonPath, autoInstallPython };
