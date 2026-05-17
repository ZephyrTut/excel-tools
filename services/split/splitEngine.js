const ExcelJS = require("exceljs");
const { AppError, ErrorCodes } = require("../common/errors");
const { writeSplitOutput } = require("./excelWriter");
const {
  copyWorksheetMeta,
  copyHeaderRowsWithMerges,
  copyRowAndCellsWithOptions
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

function parseCellRef(cellRef) {
  const match = /^([A-Z]+)(\d+)$/.exec(cellRef);
  if (!match) return null;
  return {
    col: match[1],
    row: Number(match[2])
  };
}

function parseMergeRange(range) {
  const [start, end] = String(range || "").split(":");
  const s = parseCellRef(start);
  const e = parseCellRef(end);
  if (!s || !e) return null;
  return {
    startCol: s.col,
    startRow: s.row,
    endCol: e.col,
    endRow: e.row
  };
}

function buildSingleRowMergeMap(sourceSheet) {
  const mergesBySourceRow = new Map();
  const merges = sourceSheet.model?.merges || [];
  for (const range of merges) {
    const parsed = parseMergeRange(range);
    if (!parsed) continue;
    if (parsed.startRow !== parsed.endRow) continue;
    if (!mergesBySourceRow.has(parsed.startRow)) {
      mergesBySourceRow.set(parsed.startRow, []);
    }
    mergesBySourceRow.get(parsed.startRow).push({
      startCol: parsed.startCol,
      endCol: parsed.endCol
    });
  }
  return mergesBySourceRow;
}

function resolveSequenceColumn(sourceSheet, headerRows) {
  let seqCol = -1;
  for (let r = 1; r <= headerRows; r += 1) {
    const row = sourceSheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, cn) => {
      const v = String(cell.value || "").trim();
      if (v === "序号" && seqCol === -1) seqCol = cn;
    });
    if (seqCol > 0) break;
  }
  return seqCol;
}

function buildRuleContexts(workbook, rules) {
  return buildRuleContextsWithTemplate(workbook, rules, null);
}

function buildRuleContextsWithTemplate(workbook, rules, templateWorkbook) {
  return rules.map((rule) => {
    const sourceSheet = workbook.getWorksheet(rule.sheetName);
    if (!sourceSheet) {
      throw new AppError(
        ErrorCodes.SHEET_NOT_FOUND,
        `Sheet "${rule.sheetName}" not found.`,
        { sheetName: rule.sheetName }
      );
    }
    const outputSheetName = rule.outputSheetName || rule.sheetName;
    const templateSheet = templateWorkbook?.getWorksheet(outputSheetName) || null;
    const headerSheet = sourceSheet;
    return {
      ...rule,
      sourceSheet,
      templateSheet,
      headerSheet,
      outputSheetName,
      sequenceColumnIndex: resolveSequenceColumn(sourceSheet, rule.headerRows),
      singleRowMergesBySourceRow: buildSingleRowMergeMap(sourceSheet),
      zeroFillColumnIndexes: resolveZeroFillColumns(headerSheet, rule.headerRows),
      preserveSourceFillColumnIndexes: resolvePreserveSourceFillColumns(
        outputSheetName,
        sourceSheet,
        rule.headerRows,
        templateSheet
      )
    };
  });
}

const DAILY_REPORT_AVAILABLE_STOCK_FALLBACK_COLUMNS = [13];

function normalizeHeaderText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value.text) return String(value.text);
    if (value.richText) {
      return value.richText.map((item) => item.text || "").join("");
    }
    if (value.result !== undefined) return String(value.result ?? "");
  }
  return String(value);
}

function resolveZeroFillColumns(headerSheet, headerRows) {
  const colSet = new Set();
  let snpColumn = -1;

  // 找到 SNP 列的列号（标题行中文本完全等于 "SNP" 的列）
  for (let r = 1; r <= headerRows && snpColumn === -1; r += 1) {
    const row = headerSheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = normalizeHeaderText(cell.value).replace(/\s+/g, "");
      if (text === "SNP") {
        snpColumn = colNumber;
      }
    });
  }

  // 所有有内容的列（除 SNP 列外）都加入零填充集合
  for (let r = 1; r <= headerRows; r += 1) {
    const row = headerSheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (colNumber !== snpColumn) {
        colSet.add(colNumber);
      }
    });
  }

  return colSet;
}

function resolveColumnByHeaderKeywords(sheet, headerRows, keywords) {
  if (!sheet) return -1;
  for (let r = 1; r <= headerRows; r += 1) {
    const row = sheet.getRow(r);
    let foundCol = -1;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = normalizeHeaderText(cell.value).replace(/\s+/g, "");
      if (keywords.some((keyword) => text === keyword)) {
        foundCol = colNumber;
      }
    });
    if (foundCol > 0) return foundCol;
  }
  return -1;
}

function isDailyReportSheetName(sheetName) {
  const normalized = String(sheetName || "").replace(/\s+/g, "");
  return normalized === "日报" || normalized.includes("日报");
}

function resolvePreserveSourceFillColumns(
  outputSheetName,
  sourceSheet,
  headerRows,
  templateSheet
) {
  const colSet = new Set();
  if (!isDailyReportSheetName(outputSheetName)) return colSet;

  const keywords = ["可用结存"];
  const sourceCol = resolveColumnByHeaderKeywords(sourceSheet, headerRows, keywords);
  if (sourceCol > 0) colSet.add(sourceCol);

  const templateCol = resolveColumnByHeaderKeywords(templateSheet, headerRows, keywords);
  if (templateCol > 0) colSet.add(templateCol);

  // Hard fallback for daily report available stock column fill copy.
  if (colSet.size === 0) {
    for (const fallbackCol of DAILY_REPORT_AVAILABLE_STOCK_FALLBACK_COLUMNS) {
      colSet.add(fallbackCol);
    }
  }

  return colSet;
}

function collectRowsByKey(ruleContexts, splitConfig) {
  const rowsByKey = new Map();
  for (const rule of ruleContexts) {
    const sourceSheet = rule.sourceSheet;
    for (let rowNum = rule.headerRows + 1; rowNum <= sourceSheet.rowCount; rowNum += 1) {
      const row = sourceSheet.getRow(rowNum);
      const key = resolveSplitKey(
        row.getCell(rule.splitColumnIndex).value,
        rule,
        splitConfig
      );
      if (!key) continue;
      if (!rowsByKey.has(key)) rowsByKey.set(key, new Map());
      const rowMapBySheet = rowsByKey.get(key);
      if (!rowMapBySheet.has(rule.outputSheetName)) {
        rowMapBySheet.set(rule.outputSheetName, []);
      }
      rowMapBySheet.get(rule.outputSheetName).push(rowNum);
    }
  }
  return rowsByKey;
}

function applySingleRowMerges(ruleContext, sourceRowNum, targetSheet, targetRowNum) {
  const merges = ruleContext.singleRowMergesBySourceRow.get(sourceRowNum) || [];
  for (const merge of merges) {
    targetSheet.mergeCells(
      `${merge.startCol}${targetRowNum}:${merge.endCol}${targetRowNum}`
    );
  }
}

function buildOutputWorkbookForKey(ruleContexts, rowsBySheetForKey) {
  const outputBook = new ExcelJS.Workbook();
  for (const context of ruleContexts) {
    const targetSheet = outputBook.addWorksheet(context.outputSheetName);
    copyWorksheetMeta(context.headerSheet, targetSheet, context.templateSheet);
    copyHeaderRowsWithMerges(context.headerSheet, targetSheet, context.headerRows, context.templateSheet);

    const sourceRows = rowsBySheetForKey.get(context.outputSheetName) || [];
    let seq = 0;
    let _debugCount = 0;
    for (const sourceRowNum of sourceRows) {
      const sourceRow = context.sourceSheet.getRow(sourceRowNum);
      const targetRowNum = targetSheet.rowCount + 1;
      const templateDataStartRow = context.headerRows + 1;
      const templateStyleRow =
        context.templateSheet?.getRow(targetRowNum) ||
        context.templateSheet?.getRow(templateDataStartRow) ||
        null;


      copyRowAndCellsWithOptions(sourceRow, targetSheet, targetRowNum, {
        zeroFillColumns: context.zeroFillColumnIndexes,
        styleRow: templateStyleRow,
        preserveSourceFillColumns: context.preserveSourceFillColumnIndexes
      });
      applySingleRowMerges(context, sourceRowNum, targetSheet, targetRowNum);
      if (context.sequenceColumnIndex > 0) {
        seq += 1;
        targetSheet.getRow(targetRowNum).getCell(context.sequenceColumnIndex).value = seq;
      }
    }

  }
  return outputBook;
}

async function runSplitEngine({
  workbook,
  templateWorkbook,
  rules,
  outputOptions,
  splitConfig,
  logger,
  reportProgress
}) {
  const config = splitConfig || {};
  const ruleContexts = buildRuleContextsWithTemplate(
    workbook,
    rules,
    templateWorkbook || null
  );

  reportProgress(10, "Collecting split rows");
  const rowsByKey = collectRowsByKey(ruleContexts, config);
  if (rowsByKey.size === 0) {
    throw new AppError(
      ErrorCodes.NO_SPLIT_KEYS,
      "No split keys found in enabled sheets.",
      {}
    );
  }

  logger.info("Split keys collected.", { count: rowsByKey.size });
  reportProgress(30, "Building and exporting files");
  const outputFiles = [];
  const totalKeys = rowsByKey.size;
  let index = 0;
  for (const [key, rowsBySheetForKey] of rowsByKey.entries()) {
    index += 1;
    const progress = 30 + Math.floor((index / totalKeys) * 69);
    reportProgress(progress, `Exporting files (${index}/${totalKeys})`);
    const outputBook = buildOutputWorkbookForKey(ruleContexts, rowsBySheetForKey);
    const filePath = await writeSplitOutput(key, outputBook, outputOptions, logger);
    outputFiles.push(filePath);
  }
  reportProgress(100, "Completed");

  return {
    outputFiles,
    splitKeyCount: rowsByKey.size
  };
}

module.exports = {
  runSplitEngine
};
