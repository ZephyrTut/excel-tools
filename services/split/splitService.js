const path = require('path');
const { loadRules } = require('../common/ruleManager');
const { createLogger } = require('../common/logger');
const { readWorkbook } = require('./excelReader');
const { ensureDir, writeWorkbook } = require('./excelWriter');
const { copyColumnMeta, copyRowStyle, copyMerges } = require('./styleCopier');

function sanitizeFileName(name) {
  return String(name ?? 'EMPTY').replace(/[\\/:*?"<>|]/g, '_').trim() || 'EMPTY';
}

function columnToIndex(column) {
  if (!column || typeof column !== 'string') throw new Error(`非法拆分列: ${column}`);
  const normalized = column.trim().toUpperCase();
  let result = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code < 65 || code > 90) throw new Error(`非法拆分列: ${column}`);
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

async function runSplitTask({ sourceFile, outputDir, rulesPath, onLog }) {
  const logger = createLogger(onLog);
  try {
    const rules = await loadRules(rulesPath);
    const enabledRules = (rules.sheetRules || []).filter((r) => r.enabled);
    if (enabledRules.length === 0) throw new Error('没有启用的 sheetRules');

    logger.info(`读取源文件: ${sourceFile}`);
    const sourceWb = await readWorkbook(sourceFile);
    await ensureDir(outputDir);

    const sheetMetas = [];
    const globalKeys = new Set();
    const failedItems = [];

    for (const rule of enabledRules) {
      const ws = sourceWb.getWorksheet(rule.sheetName);
      if (!ws) {
        const message = `sheet 缺失: ${rule.sheetName}`;
        logger.warn(message);
        failedItems.push(message);
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

    const summary = {
      totalKeys: globalKeys.size,
      outputFileCount: fileCount,
      failedItems
    };
    logger.info(`任务结束，共键数 ${summary.totalKeys}，输出 ${summary.outputFileCount} 个文件，失败项 ${summary.failedItems.length}`);
    return { success: true, fileCount, summary };
  } catch (error) {
    logger.error(error.message);
    return { success: false, error: error.message, summary: { totalKeys: 0, outputFileCount: 0, failedItems: [error.message] } };
  }
}

module.exports = { runSplitTask, sanitizeFileName, columnToIndex };
