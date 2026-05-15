const fs = require('fs/promises');

const ALLOWED_SHEET_MISSING_STRATEGIES = ['warnAndContinue', 'failFast'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateRule(rule, index) {
  const tag = `sheetRules[${index}]`;
  assert(rule && typeof rule === 'object', `${tag} 必须是对象`);
  assert(typeof rule.sheetName === 'string' && rule.sheetName.trim(), `${tag}.sheetName 不能为空`);
  assert(typeof rule.splitColumn === 'string' && rule.splitColumn.trim(), `${tag}.splitColumn 不能为空`);

  if (rule.sheetMissingStrategy !== undefined) {
    assert(
      ALLOWED_SHEET_MISSING_STRATEGIES.includes(rule.sheetMissingStrategy),
      `${tag}.sheetMissingStrategy 仅支持 ${ALLOWED_SHEET_MISSING_STRATEGIES.join(' / ')}`
    );
  }
}

function validateRules(rules) {
  assert(rules && typeof rules === 'object', '规则文件格式错误');
  assert(Array.isArray(rules.sheetRules), 'sheetRules 必须为数组');
  rules.sheetRules.forEach(validateRule);
  return rules;
}

async function loadRules(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  const rules = JSON.parse(text);
  return validateRules(rules);
}

module.exports = { loadRules, validateRules, ALLOWED_SHEET_MISSING_STRATEGIES };
