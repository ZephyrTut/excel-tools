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
    const headerSheet = templateSheet || sourceSheet;
    return {
      ...rule,
      sourceSheet,
      headerSheet,
      outputSheetName,
      sequenceColumnIndex: resolveSequenceColumn(sourceSheet, rule.headerRows),
      singleRowMergesBySourceRow: buildSingleRowMergeMap(sourceSheet),
      zeroFillColumnIndexes: resolveZeroFillColumns(headerSheet, rule.headerRows)
    };
  });
}

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
  const keywords = ["入库", "出库", "领跑良品退回", "零跑退回良品"];
  const colSet = new Set();
  for (let r = 1; r <= headerRows; r += 1) {
    const row = headerSheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const text = normalizeHeaderText(cell.value).replace(/\s+/g, "");
      if (keywords.some((keyword) => text.includes(keyword))) {
        colSet.add(colNumber);
      }
    });
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
    copyWorksheetMeta(context.headerSheet, targetSheet);
    copyHeaderRowsWithMerges(context.headerSheet, targetSheet, context.headerRows);

    const sourceRows = rowsBySheetForKey.get(context.outputSheetName) || [];
    let seq = 0;
    for (const sourceRowNum of sourceRows) {
      const sourceRow = context.sourceSheet.getRow(sourceRowNum);
      const targetRowNum = targetSheet.rowCount + 1;
      copyRowAndCellsWithOptions(sourceRow, targetSheet, targetRowNum, {
        zeroFillColumns: context.zeroFillColumnIndexes
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
