const path = require('path');

const DEFAULT_TEMPLATE = '{key}';
const ALLOWED_POLICIES = new Set(['overwrite', 'timestamp', 'increment']);

function sanitizeFileName(name) {
  return String(name ?? 'EMPTY').replace(/[\\/:*?"<>|]/g, '_').trim() || 'EMPTY';
}

function renderFileNameTemplate(template, context) {
  const source = typeof template === 'string' && template.trim() ? template.trim() : DEFAULT_TEMPLATE;
  return source.replace(/\{(key|sheet|date|time|datetime)\}/g, (_m, token) => {
    if (token === 'key') return sanitizeFileName(context.key);
    if (token === 'sheet') return sanitizeFileName(context.sheetName || 'sheet');
    if (token === 'date') return context.date;
    if (token === 'time') return context.time;
    if (token === 'datetime') return `${context.date}-${context.time}`;
    return '';
  });
}

function resolveFilePath({ outputDir, fileNameTemplate, conflictPolicy, key, sheetName }) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, '-');
  const baseName = sanitizeFileName(renderFileNameTemplate(fileNameTemplate, { key, sheetName, date, time }));
  const policy = ALLOWED_POLICIES.has(conflictPolicy) ? conflictPolicy : 'timestamp';

  if (policy === 'overwrite') return path.join(outputDir, `${baseName}.xlsx`);
  if (policy === 'timestamp') return path.join(outputDir, `${baseName}-${date}-${time}.xlsx`);

  // increment
  return path.join(outputDir, `${baseName}.xlsx`);
}

module.exports = {
  DEFAULT_TEMPLATE,
  ALLOWED_POLICIES,
  sanitizeFileName,
  renderFileNameTemplate,
  resolveFilePath
};
