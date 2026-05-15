const path = require('path');
const { loadRules } = require('../common/ruleManager');
const { createLogger } = require('../common/logger');
const { readWorkbook } = require('./excelReader');
const { ensureDir, writeWorkbook } = require('./excelWriter');
const { copyColumnMeta, copyRowStyle, copyMerges } = require('./styleCopier');

function createAppError(code, message, detail = {}) {
  return { code, message, detail };
}

function sanitizeFileName(name) {
  return String(name ?? 'EMPTY').replace(/[\\/:*?"<>|]/g, '_').trim() || 'EMPTY';
}

function columnToIndex(column) {
  if (!column || typeof column !== 'string') {
    throw createAppError('COLUMN_INVALID', `非法拆分列: ${column}`, { column });
  }
  const normalized = column.trim().toUpperCase();
  let result = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code < 65 || code > 90) {
      throw createAppError('COLUMN_INVALID', `非法拆分列: ${column}`, { column });
    }
    result = result * 26 + (code - 64);
  }
  return result;
}

function resolveOutputPath(outputDir, key, overwriteIfExists) {
  const baseName = sanitizeFileName(key);
  if (overwriteIfExists) return path.join(outputDir, `${baseName}.xlsx`);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(outputDir, `${baseName}-${stamp}.xlsx`);
}

function buildGroupedRowsByKey(worksheet, headerRows, splitColumnIndex, skipEmpty) {
  const groups = new Map();
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRows) return;
    const raw = row.getCell(splitColumnIndex).value;
    const key = sanitizeFileName(raw && raw.text ? raw.text : raw);
    if (skipEmpty && key === 'EMPTY') return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rowNumber);
  });
  return groups;
}

function normalizeError(error) {
  if (error && error.code && error.message) return error;
  if (error && (error.code === 'EACCES' || error.code === 'EPERM')) {
    return createAppError('PERMISSION_DENIED', '无权限访问文件或目录', { originalCode: error.code, path: error.path });
  }
  if (error && (error.code === 'EBUSY' || error.code === 'ETXTBSY')) {
    return createAppError('FILE_LOCKED', '文件被占用，请关闭后重试', { originalCode: error.code, path: error.path });
  }
  return createAppError('UNKNOWN_ERROR', error?.message || '未知错误', { originalCode: error?.code, stack: error?.stack });
}

async function runSplitTask({ sourceFile, outputDir, rulesPath, onLog }) {
  const logger = createLogger(onLog);
  try {
    const rules = await loadRules(rulesPath);
    const enabledRules = (rules.sheetRules || []).filter((r) => r.enabled);
    if (enabledRules.length === 0) throw createAppError('RULES_EMPTY', '没有启用的 sheetRules');

    logger.info(`读取源文件: ${sourceFile}`);
    const sourceWb = await readWorkbook(sourceFile);
    await ensureDir(outputDir);

    const sheetMetas = [];
    const globalKeys = new Set();

    for (const rule of enabledRules) {
      const ws = sourceWb.getWorksheet(rule.sheetName);
      if (!ws) {
        const strategy = rule.sheetMissingStrategy || 'warnAndContinue';
        if (strategy === 'failFast') {
          throw createAppError('SHEET_MISSING', `sheet 缺失: ${rule.sheetName}`, {
            sheetName: rule.sheetName,
            strategy
          });
        }
        logger.warn(`sheet 缺失: ${rule.sheetName}，已按 warnAndContinue 跳过`);
        continue;
      }

      const headerRows = Number(rule.headerRows || 1);
      const splitColumnIndex = columnToIndex(rule.splitColumn);
      const groups = buildGroupedRowsByKey(ws, headerRows, splitColumnIndex, rule.skipEmpty ?? false);
      groups.forEach((_v, k) => globalKeys.add(k));

      sheetMetas.push({ rule, worksheet: ws, headerRows, groups });
      logger.info(`sheet ${rule.sheetName} 分组完成，键数量 ${groups.size}`);
    }

    let fileCount = 0;
    for (const key of globalKeys) {
      const outWb = new (require('exceljs').Workbook)();
      for (const meta of sheetMetas) {
        const outWs = outWb.addWorksheet(meta.rule.outputSheetName || meta.rule.sheetName);
        copyColumnMeta(meta.worksheet, outWs);

        for (let i = 1; i <= meta.headerRows; i += 1) {
          const sourceRow = meta.worksheet.getRow(i);
          const inserted = outWs.addRow(sourceRow.values);
          copyRowStyle(sourceRow, inserted);
        }

        const targetRows = meta.groups.get(key) || [];
        targetRows.forEach((sourceRowNum) => {
          const sourceRow = meta.worksheet.getRow(sourceRowNum);
          const inserted = outWs.addRow(sourceRow.values);
          copyRowStyle(sourceRow, inserted);
        });

        copyMerges(meta.worksheet, outWs);
      }

      const outputPath = resolveOutputPath(outputDir, key, rules.overwriteIfExists === true);
      await writeWorkbook(outWb, outputPath);
      fileCount += 1;
      logger.info(`输出完成: ${outputPath}`);
    }

    logger.info(`任务结束，共输出 ${fileCount} 个文件`);
    return { success: true, fileCount };
  } catch (error) {
    const normalized = normalizeError(error);
    logger.error(`${normalized.code}: ${normalized.message}`);
    return { success: false, error: normalized };
  }
}

module.exports = { runSplitTask, sanitizeFileName, columnToIndex, createAppError, normalizeError };
