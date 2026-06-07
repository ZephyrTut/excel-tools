"use strict";

/**
 * 替换模板字符串中的变量
 * @param {string} template
 * @param {string} originalFileName
 * @returns {string}
 */
function replaceVariables(template, originalFileName) {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const dateStr = `${y}-${m}-${d}`;

  const dotIdx = originalFileName.lastIndexOf(".");
  const baseName =
    dotIdx > 0 ? originalFileName.slice(0, dotIdx) : originalFileName;

  return template
    .replace(/\{\{date\}\}/g, dateStr)
    .replace(/\{\{fileName\}\}/g, baseName);
}

/**
 * 将文件列表与规则列表匹配
 * @param {string[]} fileNames - 文件名列表
 * @param {Array} rules - 规则对象数组
 * @returns {{ matched: Array, unmatched: string[] }}
 */
function matchFiles(fileNames, rules) {
  const ruleMap = new Map();
  for (const rule of rules) {
    ruleMap.set(rule.originalName, rule);
  }

  const matched = [];
  const unmatched = [];

  for (const fileName of fileNames) {
    const rule = ruleMap.get(fileName);
    if (rule) {
      const resolvedMappedName = rule.mappedName
        ? replaceVariables(rule.mappedName, fileName)
        : fileName;
      const resolvedSubject = rule.emailSubject
        ? replaceVariables(rule.emailSubject, fileName)
        : "";

      matched.push({
        originalName: fileName,
        mappedName: resolvedMappedName,
        rule,
        resolvedSubject,
        channels: [...rule.channels],
      });
    } else {
      unmatched.push(fileName);
    }
  }

  return { matched, unmatched };
}

module.exports = { replaceVariables, matchFiles };
