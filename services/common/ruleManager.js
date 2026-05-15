const fs = require('fs/promises');

function validateRules(rules) {
  const errors = [];
  if (!rules || typeof rules !== 'object') errors.push('规则必须为对象');
  if (!Array.isArray(rules?.sheetRules)) errors.push('sheetRules 必须为数组');

  (rules?.sheetRules || []).forEach((rule, index) => {
    if (!rule?.sheetName) errors.push(`sheetRules[${index}].sheetName 不能为空`);
    if (!rule?.splitColumn) errors.push(`sheetRules[${index}].splitColumn 不能为空`);
    if (rule?.headerRows !== undefined && Number(rule.headerRows) < 1) {
      errors.push(`sheetRules[${index}].headerRows 必须 >= 1`);
    }
  });

  return { valid: errors.length === 0, errors };
}

async function loadRules(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(text);
}

async function saveRules(filePath, rules) {
  await fs.writeFile(filePath, JSON.stringify(rules, null, 2), 'utf-8');
}

module.exports = { loadRules, saveRules, validateRules };
