"use strict";
const path = require("node:path");
const fs = require("node:fs/promises");
const ExcelJS = require("exceljs");
const { parseRuleExcel } = require("./parseRuleExcel");
const { matchFiles } = require("./ruleMatcher");
const { sendEmail } = require("./emailSender");
const { sendToWechatGroup, minimizeWechat, findPython } = require("./wechatController");

/** 将地址对象或字符串转为显示用字符串 */
function formatEmail(addr) {
  if (typeof addr === "string") return addr;
  if (addr && addr.address) {
    return addr.name ? `${addr.name} <${addr.address}>` : addr.address;
  }
  return "";
}

/** 将地址数组转为显示用逗号分隔字符串 */
function formatEmailList(arr) {
  return (arr || []).map(formatEmail).filter(Boolean).join(", ");
}
const {
  loadHistory,
  saveHistoryEntry,
  clearHistory,
} = require("./sendHistory");

/**
 * 导入规则 Excel 并保存为 JSON
 * @param {string} excelPath - 规则 Excel 文件路径
 * @param {string} userDataPath
 * @returns {Promise<{rules: Array, warnings: string[]}>}
 */
async function importRules(excelPath, userDataPath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.getWorksheet(1);
  if (!ws) {
    return { rules: [], warnings: ["Excel 文件中没有找到第一个工作表"] };
  }

  const { rules, warnings } = parseRuleExcel(ws);

  const rulesPath = path.join(userDataPath, "sendRules.json");
  await fs.writeFile(rulesPath, JSON.stringify(rules, null, 2), "utf-8");

  return { rules, warnings };
}

/**
 * 加载已保存的规则
 * @param {string} userDataPath
 * @returns {Promise<Array>}
 */
async function getRules(userDataPath) {
  const rulesPath = path.join(userDataPath, "sendRules.json");
  try {
    const raw = await fs.readFile(rulesPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * 扫描文件夹并匹配规则
 * @param {string} folderPath - 文件夹路径
 * @param {string} userDataPath
 * @returns {Promise<{matched: Array, unmatched: string[], error?: string}>}
 */
async function matchFolderFiles(folderPath, userDataPath) {
  const rules = await getRules(userDataPath);
  if (rules.length === 0) {
    return { matched: [], unmatched: [], error: "尚未导入规则" };
  }

  let entries;
  try {
    entries = await fs.readdir(folderPath, { withFileTypes: true });
  } catch {
    return { matched: [], unmatched: [], error: "无法读取文件夹" };
  }

  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((n) => n.toLowerCase().endsWith(".xlsx"))
    .filter((n) => !n.startsWith("~$"));

  const { matched, unmatched } = matchFiles(files, rules);

  for (const m of matched) {
    m.filePath = path.join(folderPath, m.originalName);
  }

  return { matched, unmatched };
}

/**
 * 加载 SMTP 配置
 * @param {string} userDataPath
 * @returns {Promise<object|null>}
 */
async function getSmtpConfig(userDataPath) {
  const configPath = path.join(userDataPath, "smtp-config.json");
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 保存 SMTP 配置
 * @param {string} userDataPath
 * @param {object} config
 * @returns {Promise<void>}
 */
async function saveSmtpConfig(userDataPath, config) {
  const configPath = path.join(userDataPath, "smtp-config.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

/**
 * 执行发送（顺序：先微信后邮件，逐个失败跳过）
 * @param {object} params
 * @param {Array} params.matched - 匹配结果
 * @param {boolean} params.wechatFirst - 默认 true
 * @param {string} params.userDataPath
 * @param {function} params.onProgress - (event) => void
 * @param {AbortSignal} [params.signal] - 可选，用于中断发送
 * @returns {Promise<{results: Array, historyEntry: object, successCount: number, failCount: number}>}
 */
async function executeSend({
  matched,
  wechatFirst = true,
  userDataPath,
  onProgress,
  signal,
}) {
  const smtpConfig = await getSmtpConfig(userDataPath);
  const results = [];
  const historyFiles = [];
  const historyTargets = [];

  let hasWechat = false;

  // 构建发送队列
  const queue = [];
  for (const item of matched) {
    for (const channel of item.channels) {
      queue.push({ ...item, channel });
    }
  }

  // 按顺序排列
  queue.sort((a, b) => {
    if (a.channel === b.channel) return 0;
    return wechatFirst
      ? a.channel === "wechat"
        ? -1
        : 1
      : a.channel === "email"
      ? -1
      : 1;
  });

  // 提前检测 Python 环境（微信发送依赖）
  const hasWechatQueue = queue.some((q) => q.channel === "wechat");
  if (hasWechatQueue) {
    const py = await findPython();
    if (!py) {
      // 无 Python 时标记所有微信项为错误并从队列移除，不阻塞邮件
      for (let qi = queue.length - 1; qi >= 0; qi--) {
        if (queue[qi].channel === "wechat") {
          const item = queue[qi];
          results.push({
            originalName: item.originalName,
            channel: "wechat",
            target: item.rule.wechatGroup,
            success: false,
            error: "未检测到 Python 环境，跳过微信发送",
          });
          historyTargets.push({
            type: "wechat",
            name: item.rule.wechatGroup,
            status: "error",
            error: "未检测到 Python 环境",
          });
          failCount++;
          queue.splice(qi, 1);
        }
      }
    }
  }

  const total = queue.length;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < queue.length; i++) {
    if (signal && signal.aborted) break;

    const item = queue[i];

    const progressEvent = {
      type: "progress",
      current: i + 1,
      total,
      currentFile: String(item.originalName || ""),
      channel: String(item.channel || ""),
      target: String(
        item.channel === "wechat"
          ? (item.rule && item.rule.wechatGroup) || ""
          : formatEmailList((item.rule && item.rule.emailTo) || [])
      ),
      status: "sending",
    };

    if (onProgress) onProgress(progressEvent);

    let result;
    if (item.channel === "wechat") {
      hasWechat = true;
      result = await sendToWechatGroup(item.rule.wechatGroup, item.filePath);
      results.push({
        originalName: item.originalName,
        channel: "wechat",
        target: item.rule.wechatGroup,
        success: result.success,
        error: result.error || null,
      });
    } else if (item.channel === "email") {
      if (!smtpConfig) {
        result = { success: false, error: "SMTP 未配置" };
      } else {
        result = await sendEmail({
          smtpConfig,
          to: item.rule.emailTo,
          cc: item.rule.emailCc,
          subject: item.resolvedSubject,
          attachments: [
            { filePath: item.filePath, mappedName: item.mappedName },
          ],
        });
      }
      results.push({
        originalName: item.originalName,
        channel: "email",
        target: formatEmailList(item.rule.emailTo),
        success: result.success,
        error: result.error || null,
      });
    }

    if (result.success) {
      successCount++;
      historyTargets.push({
        type: item.channel,
        name:
          item.channel === "wechat"
            ? item.rule.wechatGroup
            : formatEmailList(item.rule.emailTo),
        status: "success",
      });
    } else {
      failCount++;
      historyTargets.push({
        type: item.channel,
        name:
          item.channel === "wechat"
            ? item.rule.wechatGroup
            : formatEmailList(item.rule.emailTo),
        status: "error",
        error: result.error,
      });
    }

    if (onProgress) {
      onProgress({
        ...progressEvent,
        status: result.success ? "success" : "error",
      });
    }
  }

  // 所有微信发送完成后最小化窗口
  if (hasWechat) {
    minimizeWechat().catch(() => {});
  }

  // 去重 files
  const seenFiles = new Set();
  for (const item of matched) {
    if (!seenFiles.has(item.originalName)) {
      seenFiles.add(item.originalName);
      historyFiles.push(item.originalName);
    }
  }

  // 从第一个匹配项推断文件夹路径
  const folderPath =
    matched.length > 0 && matched[0].filePath
      ? path.dirname(matched[0].filePath)
      : null;

  const historyEntry = {
    date: new Date().toISOString(),
    folderPath,
    files: historyFiles,
    targets: historyTargets,
  };

  await saveHistoryEntry(userDataPath, historyEntry);

  if (onProgress) {
    onProgress({
      type: "done",
      successCount,
      failCount,
    });
  }

  return { results, historyEntry, successCount, failCount };
}

module.exports = {
  importRules,
  getRules,
  matchFolderFiles,
  getSmtpConfig,
  saveSmtpConfig,
  executeSend,
  loadHistory,
  clearHistory,
};
