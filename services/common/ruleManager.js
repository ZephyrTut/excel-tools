const fs = require('fs/promises');

function normalizeRule(rule = {}) {
  return {
    sheetName: String(rule.sheetName || '').trim(),
    enabled: rule.enabled !== false,
    headerRows: Math.max(0, Number(rule.headerRows || 1) || 1),
    splitColumn: String(rule.splitColumn || 'A').trim().toUpperCase(),
    splitBy: String(rule.splitBy || 'column').trim(),
    outputSheetName: String(rule.outputSheetName || rule.sheetName || '').trim(),
    renameMap: rule.renameMap && typeof rule.renameMap === 'object' ? rule.renameMap : {},
    valueTransform: rule.valueTransform && typeof rule.valueTransform === 'object' ? rule.valueTransform : {},
    skipEmpty: rule.skipEmpty === true
  };
}

function normalizeRules(rules = {}) {
  return {
    appName: String(rules.appName || 'Excel Tools'),
    defaultOutputDir: String(rules.defaultOutputDir || './output'),
    preserveSheetOrder: rules.preserveSheetOrder !== false,
    overwriteIfExists: rules.overwriteIfExists === true,
    sheetRules: Array.isArray(rules.sheetRules) ? rules.sheetRules.map(normalizeRule) : []
  };
}

function validateRules(rules) {
  if (!rules || typeof rules !== 'object') throw new Error('规则内容不是有效对象');
  if (!Array.isArray(rules.sheetRules) || rules.sheetRules.length === 0) {
    throw new Error('sheetRules 不能为空');
  }
  rules.sheetRules.forEach((rule, index) => {
    if (!rule.sheetName) throw new Error(`第 ${index + 1} 条规则 sheetName 不能为空`);
    if (!rule.outputSheetName) throw new Error(`第 ${index + 1} 条规则 outputSheetName 不能为空`);
    if (!/^[A-Z]+$/.test(rule.splitColumn)) throw new Error(`第 ${index + 1} 条规则 splitColumn 非法`);
  });
}

async function loadRules(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  return normalizeRules(JSON.parse(text));
}

async function saveRules(filePath, rawRules) {
  const rules = normalizeRules(rawRules);
  validateRules(rules);
  await fs.writeFile(filePath, JSON.stringify(rules, null, 2), 'utf-8');
  return rules;
}

module.exports = { loadRules, saveRules, normalizeRules, validateRules };
