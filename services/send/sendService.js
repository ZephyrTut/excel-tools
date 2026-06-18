"use strict";
const path = require("node:path");
const fs = require("node:fs/promises");
const ExcelJS = require("exceljs");
const { parseRuleExcel } = require("./parseRuleExcel");
const { matchFiles } = require("./ruleMatcher");
const { sendEmail } = require("./emailSender");
const { sendToWechatGroup, minimizeWechat, findPython, checkUiautomationInstalled, ensureUiautomationInstalled, autoInstallPython } = require("./wechatController");

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
  deleteHistoryEntry,
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
async function matchFolderFiles(folderPath, userDataPath, customRules) {
  const rules = customRules || await getRules(userDataPath);
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
  unmatched = [],
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

  let successCount = 0;
  let failCount = 0;

  // 提前检测 Python 和 uiautomation（微信发送依赖）
  const hasWechatQueue = queue.some((q) => q.channel === "wechat");
  if (hasWechatQueue) {
    let py = await findPython(userDataPath);
    if (!py) {
      // 无 Python → 尝试自动下载安装嵌入式 Python 环境
      if (onProgress) onProgress({ type: "log", level: "warn", message: "未检测到 Python，尝试自动下载安装..." });
      const installed = await autoInstallPython(userDataPath, (msg) => {
        if (onProgress) onProgress({ type: "log", level: "info", message: msg });
      });
      if (installed) {
        py = await findPython(userDataPath);
      }
    }
    if (!py) {
      // 仍无 Python → 标记所有微信项为错误并从队列移除，不阻塞邮件
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
    } else {
      // 有 Python 但检测 wx4py 是否安装
      const hasUi = await checkUiautomationInstalled(py);
      if (!hasUi) {
        if (onProgress) onProgress({ type: "log", level: "warn", message: "未检测到 wx4py，尝试自动安装..." });
        const installed = await ensureUiautomationInstalled(py);
        if (!installed) {
          if (onProgress) onProgress({ type: "log", level: "error", message: "自动安装 wx4py 失败，请手动运行: pip install wx4py" });
          for (let qi = queue.length - 1; qi >= 0; qi--) {
            if (queue[qi].channel === "wechat") {
              const item = queue[qi];
              results.push({
                originalName: item.originalName,
                channel: "wechat",
                target: item.rule.wechatGroup,
                success: false,
                error: "uiautomation 未安装且自动安装失败，跳过微信发送",
              });
              historyTargets.push({
                type: "wechat",
                name: item.rule.wechatGroup,
                status: "error",
                error: "uiautomation 未安装",
              });
              failCount++;
              queue.splice(qi, 1);
            }
          }
        }
      }
    }
  }

  const total = queue.length;

  let i;
  for (i = 0; i < queue.length; i++) {
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
    try {
      if (item.channel === "wechat") {
        hasWechat = true;
        result = await sendToWechatGroup(item.rule.wechatGroup, item.filePath, signal);
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
    } catch (err) {
      // 用户中断时立即跳出循环
      if (signal && signal.aborted) break;
      // 非中断性错误按失败处理
      failCount++;
      // 过滤技术性错误消息，避免暴露给用户
      let displayError = (err && err.message) || "发送失败";
      if (displayError.includes("JSON") || displayError.includes("Unexpected") ||
          displayError.includes("position") || displayError.includes("SyntaxError")) {
        displayError = "发送异常，请重试";
      }
      historyTargets.push({
        type: item.channel,
        name: item.channel === "wechat"
          ? item.rule.wechatGroup
          : formatEmailList(item.rule.emailTo),
        status: "error",
        error: displayError,
      });
      if (onProgress) {
        onProgress({
          ...progressEvent,
          status: "error",
        });
      }
    }
  }

  // 如果被中断，标记剩余未发送项
  if (signal && signal.aborted) {
    for (let j = i; j < queue.length; j++) {
      const item = queue[j];
      historyTargets.push({
        type: item.channel,
        name:
          item.channel === "wechat"
            ? item.rule.wechatGroup
            : formatEmailList(item.rule.emailTo),
        status: "interrupted",
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

  // 记录未匹配项到历史
  for (const umName of unmatched) {
    historyTargets.push({
      type: "skip",
      name: umName,
      status: "skipped",
      error: null,
    });
  }

  const historyEntry = {
    date: new Date().toISOString(),
    folderPath,
    files: historyFiles,
    targets: historyTargets,
    matchedDetails: matched.map((item) => ({
      originalName: item.originalName,
      mappedName: item.mappedName,
      resolvedSubject: item.resolvedSubject || null,
      channels: item.channels,
      rule: {
        wechatGroup: item.rule?.wechatGroup || null,
        emailTo: item.rule?.emailTo || [],
        emailCc: item.rule?.emailCc || [],
        emailSubject: item.rule?.emailSubject || null,
      },
    })),
    unmatched: [...unmatched],
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
  deleteHistoryEntry,
};
