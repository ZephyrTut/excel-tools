const fs = require('fs/promises');
const { DEFAULT_TEMPLATE, ALLOWED_POLICIES } = require('../split/fileNaming');

const TEMPLATE_TOKEN_REGEX = /\{(key|sheet|date|time|datetime)\}/g;

function validateTemplate(template) {
  if (typeof template !== 'string' || !template.trim()) {
    throw new Error('fileNameTemplate 必须是非空字符串');
  }
  const forbidden = /[\\/:*?"<>|]/.test(template.replace(TEMPLATE_TOKEN_REGEX, ''));
  if (forbidden) {
    throw new Error('fileNameTemplate 包含非法文件名字符');
  }

  const unknownTokenMatch = template.match(/\{[^}]+\}/g) || [];
  const unknownTokens = unknownTokenMatch.filter((token) => !['{key}', '{sheet}', '{date}', '{time}', '{datetime}'].includes(token));
  if (unknownTokens.length > 0) {
    throw new Error(`fileNameTemplate 包含未知占位符: ${unknownTokens.join(', ')}`);
  }
}

function normalizeRules(rules) {
  const next = { ...rules };
  next.fileNameTemplate = next.fileNameTemplate || DEFAULT_TEMPLATE;
  next.conflictPolicy = next.conflictPolicy || (next.overwriteIfExists ? 'overwrite' : 'timestamp');

  validateTemplate(next.fileNameTemplate);
  if (!ALLOWED_POLICIES.has(next.conflictPolicy)) {
    throw new Error(`conflictPolicy 非法: ${next.conflictPolicy}`);
  }

  return next;
}

async function loadRules(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(text);
  return normalizeRules(parsed);
}

module.exports = { loadRules, validateTemplate, normalizeRules };
