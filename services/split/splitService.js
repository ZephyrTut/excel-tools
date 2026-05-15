const path = require('path');
const fs = require('fs/promises');
const ExcelJS = require('exceljs');
const { loadRules } = require('../common/ruleManager');
const { createLogger } = require('../common/logger');
const { readWorkbook } = require('./excelReader');
const { ensureDir, writeWorkbook } = require('./excelWriter');
const { copyColumnMeta, copyRowStyle, copyMerges } = require('./styleCopier');

function sanitizeFileName(name) {
  return String(name ?? 'EMPTY').replace(/[\\/:*?"<>|]/g, '_').trim() || 'EMPTY';
}

function columnToIndex(column) {
  const normalized = String(column || '').trim().toUpperCase();
  if (!normalized) throw new Error(`非法拆分列: ${column}`);
  let result = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code < 65 || code > 90) throw new Error(`非法拆分列: ${column}`);
    result = result * 26 + (code - 64);
  }
  return result;
}

function applyValueTransform(value, mode) {
  const raw = value && value.text ? value.text : value;
  const str = String(raw ?? '').trim();
  if (!str) return 'EMPTY';
  if (mode === 'upper') return str.toUpperCase();
  if (mode === 'lower') return str.toLowerCase();
  return str;
}

async function resolveOutputPath(outputDir, key, overwriteIfExists) {
  const baseName = sanitizeFileName(key);
  const finalBase = `${baseName}.xlsx`;
  const finalPath = path.join(outputDir, finalBase);
  if (overwriteIfExists) return finalPath;

  try {
    await fs.access(finalPath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(outputDir, `${baseName}-${stamp}.xlsx`);
  } catch {
    return finalPath;
  }
}

function buildGroupedRowsByKey(worksheet, headerRows, splitColumnIndex, skipEmpty, valueTransform, renameMap) {
  const groups = new Map();
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRows) return;
    const raw = row.getCell(splitColumnIndex).value;
    let key = applyValueTransform(raw, valueTransform);
    if (renameMap[key]) key = renameMap[key];
    const sanitized = sanitizeFileName(key);
    if (skipEmpty && sanitized === 'EMPTY') return;
    if (!groups.has(sanitized)) groups.set(sanitized, []);
    groups.get(sanitized).push(rowNumber);
  });
  return groups;
}

async function runSplitTask({ sourceFile, outputDir, rulesPath, onLog }) {
  const logger = createLogger(onLog);
  try {
    const rules = await loadRules(rulesPath);
    const enabledRules = rules.sheetRules.filter((r) => r.enabled);
    if (enabledRules.length === 0) throw new Error('没有启用的 sheetRules');

    const sourceWb = await readWorkbook(sourceFile);
    await ensureDir(outputDir);

    const sheetMetas = [];
    const globalKeys = new Set();

    for (const rule of enabledRules) {
      const ws = sourceWb.getWorksheet(rule.sheetName);
      if (!ws) {
        logger.warn(`sheet 缺失: ${rule.sheetName}`);
        continue;
      }

      const splitColumnIndex = columnToIndex(rule.splitColumn);
      if (!ws.getColumn(splitColumnIndex)) {
        throw new Error(`列不存在: ${rule.sheetName}.${rule.splitColumn}`);
      }

      const groups = buildGroupedRowsByKey(
        ws,
        rule.headerRows,
        splitColumnIndex,
        rule.skipEmpty,
        rule.valueTransform,
        rule.renameMap
      );
      groups.forEach((_v, k) => globalKeys.add(k));

      sheetMetas.push({ rule, worksheet: ws, groups });
    }

    let fileCount = 0;
    for (const key of globalKeys) {
      const outWb = new ExcelJS.Workbook();
      for (const meta of sheetMetas) {
        const outWs = outWb.addWorksheet(meta.rule.outputSheetName || meta.rule.sheetName);
        copyColumnMeta(meta.worksheet, outWs);
        for (let i = 1; i <= meta.rule.headerRows; i += 1) {
          const sourceRow = meta.worksheet.getRow(i);
          const outRow = outWs.addRow(sourceRow.values);
          copyRowStyle(sourceRow, outRow);
        }
        const rowNums = meta.groups.get(key) || [];
        rowNums.forEach((rowNum) => {
          const sourceRow = meta.worksheet.getRow(rowNum);
          const outRow = outWs.addRow(sourceRow.values);
          copyRowStyle(sourceRow, outRow);
        });
        copyMerges(meta.worksheet, outWs);
      }

      const outPath = await resolveOutputPath(outputDir, key, rules.overwriteIfExists);
      await writeWorkbook(outWb, outPath);
      fileCount += 1;
      logger.info(`输出完成: ${outPath}`);
    }

    return { success: true, fileCount };
  } catch (error) {
    logger.error(error.message);
    return { success: false, error: error.message };
  }
}

module.exports = { runSplitTask, sanitizeFileName, columnToIndex };
