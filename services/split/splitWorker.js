const { parentPort, workerData } = require('worker_threads');
const ExcelJS = require('exceljs');
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

function emitProgress(progress) {
  parentPort.postMessage({ type: 'progress', ...progress });
}

async function run() {
  const { sourceFile, outputDir, rulesPath } = workerData;
  const logger = createLogger((message) => {
    parentPort.postMessage({ type: 'log', message });
  });

  try {
    emitProgress({ stage: 'load_rules', message: '读取拆分规则中...', percent: 5 });
    const rules = await loadRules(rulesPath);
    const enabledRules = (rules.sheetRules || []).filter((r) => r.enabled);
    if (enabledRules.length === 0) throw new Error('没有启用的 sheetRules');

    logger.info(`读取源文件: ${sourceFile}`);
    emitProgress({ stage: 'read_workbook', message: '读取源文件中...', percent: 12 });
    const sourceWb = await readWorkbook(sourceFile);
    await ensureDir(outputDir);

    const sheetMetas = [];
    const globalKeys = new Set();

    let scannedSheets = 0;
    for (const rule of enabledRules) {
      const ws = sourceWb.getWorksheet(rule.sheetName);
      if (!ws) {
        logger.warn(`sheet 缺失: ${rule.sheetName}`);
        continue;
      }

      emitProgress({
        stage: 'scan_sheet',
        message: `扫描 sheet: ${rule.sheetName}`,
        detail: { sheetName: rule.sheetName },
        percent: 12 + Math.round(((scannedSheets + 0.5) / enabledRules.length) * 38)
      });

      const headerRows = Number(rule.headerRows || 1);
      const splitColumnIndex = columnToIndex(rule.splitColumn);
      const groups = buildGroupedRowsByKey(ws, headerRows, splitColumnIndex, rule.skipEmpty ?? false);
      groups.forEach((_v, k) => globalKeys.add(k));

      sheetMetas.push({ rule, worksheet: ws, headerRows, groups });
      scannedSheets += 1;
      logger.info(`sheet ${rule.sheetName} 分组完成，键数量 ${groups.size}`);
    }

    let fileCount = 0;
    const totalFiles = globalKeys.size;
    for (const key of globalKeys) {
      const outWb = new ExcelJS.Workbook();
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
      emitProgress({
        stage: 'write_file',
        message: `写出第 ${fileCount + 1}/${totalFiles} 个文件`,
        detail: { outputPath, current: fileCount + 1, total: totalFiles },
        percent: 50 + Math.round(((fileCount + 1) / Math.max(totalFiles, 1)) * 48)
      });
      await writeWorkbook(outWb, outputPath);
      fileCount += 1;
      logger.info(`输出完成: ${outputPath}`);
    }

    emitProgress({ stage: 'done', message: '任务完成', percent: 100 });
    parentPort.postMessage({ type: 'result', result: { success: true, fileCount } });
  } catch (error) {
    parentPort.postMessage({ type: 'result', result: { success: false, error: error.message } });
  }
}

run();

module.exports = { sanitizeFileName, columnToIndex };
