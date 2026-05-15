const fs = require('fs/promises');

function normalizeRule(rule) {
  return {
    enabled: rule.enabled !== false,
    sheetName: rule.sheetName,
    headerRows: Number(rule.headerRows || 1),
    splitColumn: rule.splitColumn,
    splitBy: rule.splitBy || 'cellValue',
    outputSheetName: rule.outputSheetName || rule.sheetName,
    renameMap: rule.renameMap || {},
    valueTransform: rule.valueTransform || 'trim',
    skipEmpty: rule.skipEmpty === true
  };
}

function validateRules(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('规则文件无效：根节点必须是对象');
  }
  if (!Array.isArray(config.sheetRules)) {
    throw new Error('规则文件无效：sheetRules 必须是数组');
  }
  config.sheetRules.forEach((rule, idx) => {
    if (!rule.sheetName) throw new Error(`规则无效：sheetRules[${idx}].sheetName 不能为空`);
    if (!rule.splitColumn) throw new Error(`规则无效：sheetRules[${idx}].splitColumn 不能为空`);
  });
}

async function loadRules(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(text);
  validateRules(parsed);
  return {
    ...parsed,
    preserveSheetOrder: parsed.preserveSheetOrder !== false,
    overwriteIfExists: parsed.overwriteIfExists === true,
    sheetRules: parsed.sheetRules.map(normalizeRule)
  };
}

module.exports = { loadRules, validateRules };
