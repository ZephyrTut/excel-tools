"use strict";

/**
 * 从 ExcelJS worksheet 中读取单元格值
 * @param {object} row - ExcelJS Row 对象
 * @param {number} col - 列号 (1-based)
 * @returns {string}
 */
function cellText(row, col) {
  const cell = row.getCell(col);
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object") {
    if (Array.isArray(v) && v.length > 0 && v[0].text !== undefined) {
      return v.map((r) => r.text || "").join("");
    }
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.text !== undefined) return String(v.text);
    if (v.result !== undefined) return String(v.result);
    return "";
  }
  return String(v).trim();
}

/**
 * 标准化单个邮箱地址，支持阿里邮箱复制格式 "name"<email> 和 name<email>
 * @param {string} raw
 * @returns {{ name: string|null, address: string }}
 */
function normalizeEmailAddress(raw) {
  if (!raw) return { name: null, address: "" };
  const s = raw.trim();
  const match = s.match(/^(.+?)<([^>]+)>$/);
  if (match) {
    let name = match[1].trim().replace(/^["']|["']$/g, "").trim();
    const address = match[2].trim();
    return { name: name || null, address };
  }
  return { name: null, address: s };
}

/**
 * 标准化邮箱地址列表
 * @param {string[]} arr
 * @returns {Array<{ name: string|null, address: string }>}
 */
function normalizeEmailList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalizeEmailAddress).filter((e) => e.address);
}

/**
 * 将分发方式字符串解析为英文数组，支持中文和英文标识
 * @param {string} str - 分发方式，逗号分隔
 * @returns {string[]} 如 ["wechat", "email"]
 */
function parseChannels(str) {
  const channels = [];
  const parts = str.split(",").map((s) => s.trim().toLowerCase());
  for (const part of parts) {
    if (part === "微信" || part === "wechat") channels.push("wechat");
    else if (part === "邮件" || part === "email") channels.push("email");
  }
  return [...new Set(channels)];
}

/**
 * 解析发送规则 Excel 工作表
 * @param {import("exceljs").Worksheet} worksheet
 * @returns {{ rules: Array, warnings: string[] }}
 */
function parseRuleExcel(worksheet) {
  const rules = [];
  const warnings = [];

  if (!worksheet || worksheet.rowCount < 1) {
    warnings.push("工作表为空");
    return { rules, warnings };
  }

  for (let r = 2; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    if (!row || row.hidden) continue;

    const originalName = cellText(row, 1);
    if (!originalName) continue;

    const mappedName = cellText(row, 2);
    const channelStr = cellText(row, 3);
    const wechatGroup = cellText(row, 4);
    const emailSubject = cellText(row, 5);
    const emailToStr = cellText(row, 6);
    const emailCcStr = cellText(row, 7);

    if (!channelStr) {
      warnings.push(`行 ${r}: 分发方式为空`);
      continue;
    }

    const channels = parseChannels(channelStr);
    if (channels.length === 0) {
      warnings.push(`行 ${r}: 分发方式无效 (${channelStr})`);
      continue;
    }

    const hasWechat = channels.includes("wechat");
    const hasEmail = channels.includes("email");

    if (hasWechat && !wechatGroup) {
      warnings.push(`行 ${r} (${originalName}): 包含微信分发但微信群名为空`);
      continue;
    }
    if (hasEmail && !emailToStr) {
      warnings.push(`行 ${r} (${originalName}): 包含邮件分发但收件人为空`);
      continue;
    }
    if (hasEmail && !emailSubject) {
      warnings.push(`行 ${r} (${originalName}): 包含邮件分发但邮件主题为空`);
      continue;
    }

    function splitComma(s) {
      if (!s) return [];
      return s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }

    rules.push({
      originalName,
      mappedName: mappedName || originalName,
      channels,
      wechatGroup: hasWechat ? wechatGroup : null,
      emailSubject: hasEmail ? emailSubject : null,
      emailTo: normalizeEmailList(splitComma(emailToStr)),
      emailCc: normalizeEmailList(splitComma(emailCcStr)),
    });
  }

  return { rules, warnings };
}

module.exports = { parseRuleExcel, normalizeEmailAddress, normalizeEmailList };
