const ExcelJS = require("exceljs");
const { AppError, ErrorCodes } = require("../common/errors");
const { writeSplitOutputs } = require("./excelWriter");
const {
  copyWorksheetMeta,
  copyHeaderRowsWithMerges,
  copyRowAndCells,
  copySingleRowMerges
} = require("./styleCopier");

function normalizeCellValue(cellValue) {
  if (cellValue === null || cellValue === undefined) return "";
  if (typeof cellValue === "object") {
    if (cellValue.text) return String(cellValue.text);
    if (cellValue.result !== undefined) return String(cellValue.result ?? "");
    if (cellValue.richText) {
      return cellValue.richText.map((item) => item.text || "").join("");
    }
    if (cellValue.hyperlink) return String(cellValue.text || cellValue.hyperlink);
    return String(cellValue.toString?.() || "");
  }
  return String(cellValue);
}

function resolveSplitKey(rawValue, rule, splitConfig) {
  const trim = splitConfig?.trimSplitKey !== false;
  const skipEmpty = rule.skipEmpty ?? splitConfig?.skipEmptySplitKey ?? true;

  const value = trim ? normalizeCellValue(rawValue).trim() : normalizeCellValue(rawValue);
  if (!value && skipEmpty) return null;
  return value || "EMPTY";
}

function collectSplitKeys(workbook, rules, splitConfig) {
  const keySet = new Set();
  for (const rule of rules) {
    const sheet = workbook.getWorksheet(rule.sheetName);
    if (!sheet) {
      throw new AppError(
        ErrorCodes.SHEET_NOT_FOUND,
        `Sheet "${rule.sheetName}" not found.`,
        { sheetName: rule.sheetName }
      );
    }

    for (let rowNum = rule.headerRows + 1; rowNum <= sheet.rowCount; rowNum += 1) {
      const row = sheet.getRow(rowNum);
      const key = resolveSplitKey(
        row.getCell(rule.splitColumnIndex).value,
        rule,
        splitConfig
      );
      if (key) keySet.add(key);
    }
  }
  return keySet;
}

function buildOutputBooks(workbook, rules, keySet) {
  const map = new Map();
  for (const key of keySet) {
    const outputBook = new ExcelJS.Workbook();
    for (const rule of rules) {
      const sourceSheet = workbook.getWorksheet(rule.sheetName);
      const outputSheetName = rule.outputSheetName || rule.sheetName;
      const targetSheet = outputBook.addWorksheet(outputSheetName);
      copyWorksheetMeta(sourceSheet, targetSheet);
      copyHeaderRowsWithMerges(sourceSheet, targetSheet, rule.headerRows);
    }
    map.set(key, outputBook);
  }
  return map;
}

function fillOutputBooks(workbook, rules, outputBooks, splitConfig) {
  for (const rule of rules) {
    const sourceSheet = workbook.getWorksheet(rule.sheetName);
    const outputSheetName = rule.outputSheetName || rule.sheetName;

    for (let rowNum = rule.headerRows + 1; rowNum <= sourceSheet.rowCount; rowNum += 1) {
      const sourceRow = sourceSheet.getRow(rowNum);
      const key = resolveSplitKey(
        sourceRow.getCell(rule.splitColumnIndex).value,
        rule,
        splitConfig
      );
      if (!key) continue;

      const outputBook = outputBooks.get(key);
      if (!outputBook) continue;
      const targetSheet = outputBook.getWorksheet(outputSheetName);
      const targetRowNum = targetSheet.rowCount + 1;
      copyRowAndCells(sourceRow, targetSheet, targetRowNum);
      copySingleRowMerges(sourceSheet, targetSheet, rowNum, targetRowNum);
    }
  }
}

async function runSplitEngine({
  workbook,
  rules,
  outputOptions,
  splitConfig,
  logger,
  reportProgress
}) {
  const config = splitConfig || {};
  reportProgress(10, "Collecting split keys");
  const keySet = collectSplitKeys(workbook, rules, config);
  if (keySet.size === 0) {
    throw new AppError(
      ErrorCodes.NO_SPLIT_KEYS,
      "No split keys found in enabled sheets.",
      {}
    );
  }

  logger.info("Split keys collected.", { count: keySet.size });
  reportProgress(30, "Building output workbooks");
  const outputBooks = buildOutputBooks(workbook, rules, keySet);

  reportProgress(55, "Writing split rows");
  fillOutputBooks(workbook, rules, outputBooks, config);

  reportProgress(80, "Exporting files");
  const outputFiles = await writeSplitOutputs(outputBooks, outputOptions, logger);
  reportProgress(100, "Completed");

  return {
    outputFiles,
    splitKeyCount: keySet.size
  };
}

module.exports = {
  runSplitEngine
};
