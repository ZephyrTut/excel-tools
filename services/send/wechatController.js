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
    return { success: false, error: err.message || "Python 脚本执行失败" };
  }
}

module.exports = { sendToWechatGroup };
