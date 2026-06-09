"use strict";
const { execFile } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

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
 * 检测可用的 Python 命令
 * @returns {Promise<string|null>} 找到则返回命令名/路径，否则返回 null
 */
async function findPython() {
  if (_pythonChecked) return _pythonCommand;
  _pythonChecked = true;

  // 1. 优先使用打包的便携 Python
  const bundled = getBundledPythonPath();
  if (bundled) {
    try {
      const { stdout } = await execFileAsync(bundled, ["--version"], {
        timeout: 3000,
      });
      if (stdout && stdout.toLowerCase().includes("python")) {
        _pythonCommand = bundled;
        return _pythonCommand;
      }
    } catch {
      // 打包的 Python 不可用，回退到系统 Python
    }
  }

  // 2. 回退到系统 Python
  for (const cmd of PYTHON_CANDIDATES) {
    try {
      const [prog, ...args] = cmd.split(" ");
      const { stdout } = await execFileAsync(prog, [...args, "--version"], {
        timeout: 3000,
      });
      if (stdout && stdout.toLowerCase().includes("python")) {
        _pythonCommand = cmd;
        return _pythonCommand;
      }
    } catch {
      continue;
    }
  }

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

// ── 微信发送 ──────────────────────────────────────────────────────

/**
 * 通过 Python uiautomation 脚本发送文件到微信群
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

  const scriptPath = path.join(__dirname, "wechat_sender.py");

  try {
    const [prog, ...args] = pythonCmd.split(" ");
    const { stdout } = await execFileAsync(
      prog,
      [...args, scriptPath, "--group", groupName, "--file", filePath],
      { timeout: 60000, signal }
    );

    const result = JSON.parse(stdout.trim());
    return result;
  } catch (err) {
    let errorMsg = err.message || "Python 脚本执行失败";
    if (err.stdout) {
      try {
        const parsed = JSON.parse(err.stdout.trim());
        if (parsed && parsed.error) {
          errorMsg = parsed.error;
        }
      } catch { /* ignore JSON parse failure */ }
    }
    return { success: false, error: errorMsg };
  }
}

async function minimizeWechat() {
  const pythonCmd = await findPython();
  if (!pythonCmd) return { success: false, error: "Python not found" };

  const scriptPath = path.join(__dirname, "wechat_sender.py");

  try {
    const [prog, ...args] = pythonCmd.split(" ");
    const { stdout } = await execFileAsync(
      prog,
      [...args, scriptPath, "--action", "minimize"],
      { timeout: 10000 }
    );
    return JSON.parse(stdout.trim());
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendToWechatGroup, minimizeWechat, findPython, resetPythonCheck };
