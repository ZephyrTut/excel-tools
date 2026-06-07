"use strict";
const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

/**
 * 通过 Python uiautomation 脚本发送文件到微信群
 * @param {string} groupName - 微信群名称
 * @param {string} filePath - 文件绝对路径
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendToWechatGroup(groupName, filePath) {
  const scriptPath = path.join(__dirname, "wechat_sender.py");

  try {
    const { stdout } = await execFileAsync(
      "python",
      [scriptPath, "--group", groupName, "--file", filePath],
      { timeout: 60000 }
    );

    const result = JSON.parse(stdout.trim());
    return result;
  } catch (err) {
    // 尝试从 stdout 提取 JSON 错误信息（Python 脚本可能输出了友好错误后正常退出）
    let errorMsg = err.message || "Python 脚本执行失败";
    if (err.stdout) {
      try {
        const parsed = JSON.parse(err.stdout.trim());
        if (parsed && parsed.error) {
          errorMsg = parsed.error;
        }
      } catch { /* ignore parse failure */ }
    }
    return { success: false, error: errorMsg };
  }
}

async function minimizeWechat() {
  const scriptPath = path.join(__dirname, "wechat_sender.py");

  try {
    const { stdout } = await execFileAsync(
      "python",
      [scriptPath, "--action", "minimize"],
      { timeout: 10000 }
    );
    return JSON.parse(stdout.trim());
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = { sendToWechatGroup, minimizeWechat };
