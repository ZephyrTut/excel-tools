const ExcelJS = require("exceljs");
const { AppError, ErrorCodes } = require("./errors");
const { writeSplitOutput } = require("./excelWriter");
const {
  extractConditionalFormattingNodes,
  findWorksheetMaxRow,
  findWorksheetDeclaredMaxRow,
} = require("../optimize/zipUtils");
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

function buildRuleContextsWithTemplate(
  workbook,
  rules,
  templateWorkbook,
  sourceSheetXmlMap,
  templateSheetXmlMap
) {
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
    const sourceWorksheetXml = sourceSheetXmlMap?.get(rule.sheetName)?.xml || null;
    const templateWorksheetXml = templateSheetXmlMap?.get(outputSheetName)?.xml || null;
    return {
      ...rule,
      sourceSheet,
      templateSheet,
      headerSheet,
      outputSheetName,
      sourceWorksheetActualMaxRow: findWorksheetMaxRow(sourceWorksheetXml),
      sourceWorksheetDeclaredMaxRow: findWorksheetDeclaredMaxRow(sourceWorksheetXml),
      sourceConditionalFormattingNodes: extractConditionalFormattingNodes(sourceWorksheetXml),
      templateConditionalFormattingNodes: extractConditionalFormattingNodes(templateWorksheetXml),
      sequenceColumnIndex: resolveSequenceColumn(sourceSheet, rule.headerRows),
      singleRowMergesBySourceRow: buildSingleRowMergeMap(sourceSheet),
      zeroFillColumnIndexes: isDailyReportSheetName(outputSheetName)
        ? resolveZeroFillColumns(headerSheet, rule.headerRows)
        : new Set(),
      preserveSourceFillColumnIndexes: resolvePreserveSourceFillColumns(
        outputSheetName,
        sourceSheet,
        rule.headerRows,
        templateSheet
      )
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

  // 1. Try exact match via resolveColumnByHeaderKeywords (handles normal + richText)
  const keywords = ["可用结存", "可用结余", "结存"];
  const sourceCol = resolveColumnByHeaderKeywords(sourceSheet, headerRows, keywords);
  if (sourceCol > 0) colSet.add(sourceCol);

  const templateCol = resolveColumnByHeaderKeywords(templateSheet, headerRows, keywords);
  if (templateCol > 0) colSet.add(templateCol);

  // 2. Fallback: scan ALL header cells for any column whose text CONTAINS "可用结存"
  //    (handles cases where the header has extra whitespace, line breaks, or richText artifacts)
  if (colSet.size === 0) {
    for (let r = 1; r <= headerRows; r++) {
      const row = sourceSheet.getRow(r);
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colSet.has(colNumber)) return;
        const text = normalizeHeaderText(cell.value).replace(/\s+/g, "");
        if (text.includes("可用结存") || text.includes("结存")) {
          colSet.add(colNumber);
        }
      });
    }
  }

  // 3. If still nothing found, also check the first data row for column continuity
  if (colSet.size === 0 && headerRows > 0) {
    const firstDataRow = sourceSheet.getRow(headerRows + 1);
    if (firstDataRow) {
      firstDataRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colSet.has(colNumber)) return;
        // If this column had content in every header row, it's likely a data column
        let allHeadersHaveContent = true;
        for (let r = 1; r <= headerRows; r++) {
          if (!sourceSheet.getRow(r).getCell(colNumber).value) {
            allHeadersHaveContent = false;
            break;
          }
        }
        if (allHeadersHaveContent) {
          colSet.add(colNumber);
        }
      });
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

function buildOutputWorkbookForKey(ruleContexts, rowsBySheetForKey, sourceDifferentialStylesNode) {
  const outputBook = new ExcelJS.Workbook();
  const sheetTransforms = {};
  for (const context of ruleContexts) {
    const targetSheet = outputBook.addWorksheet(context.outputSheetName);
    copyWorksheetMeta(context.headerSheet, targetSheet, context.templateSheet);
    copyHeaderRowsWithMerges(context.headerSheet, targetSheet, context.headerRows, context.templateSheet);

    const sourceRows = rowsBySheetForKey.get(context.outputSheetName) || [];
    const rowMap = new Map();
    for (let rowNum = 1; rowNum <= context.headerRows; rowNum += 1) {
      rowMap.set(rowNum, rowNum);
    }
    let seq = 0;
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
      rowMap.set(sourceRowNum, targetRowNum);
      if (context.sequenceColumnIndex > 0) {
        seq += 1;
        targetSheet.getRow(targetRowNum).getCell(context.sequenceColumnIndex).value = seq;
      }
    }

    sheetTransforms[context.outputSheetName] = {
      conditionalFormatting: {
        mode: "remap",
        nodes: context.sourceConditionalFormattingNodes,
        rowMap: [...rowMap.entries()],
        sourceMaxRow: context.sourceWorksheetDeclaredMaxRow,
        trailingRowPadding: Math.max(
          0,
          context.sourceWorksheetDeclaredMaxRow - context.sourceWorksheetActualMaxRow
        ),
      },
      preserveMaxRow:
        targetSheet.rowCount +
        Math.max(0, context.sourceWorksheetDeclaredMaxRow - context.sourceWorksheetActualMaxRow),
      normalizeView: { clearFrozenPane: true },
      trimTrailingRows: true,
    };
  }
  return {
    workbook: outputBook,
    postProcess: {
      sheetTransforms,
      stylesTransform: {
        differentialStylesNode: sourceDifferentialStylesNode,
      },
    },
  };
}

async function runSplitEngine({
  workbook,
  templateWorkbook,
  sourceSheetXmlMap,
  templateSheetXmlMap,
  sourceDifferentialStylesNode,
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
    templateWorkbook || null,
    sourceSheetXmlMap || null,
    templateSheetXmlMap || null
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
    const outputBundle = buildOutputWorkbookForKey(
      ruleContexts,
      rowsBySheetForKey,
      sourceDifferentialStylesNode
    );
    const filePath = await writeSplitOutput(
      key,
      outputBundle.workbook,
      outputOptions,
      logger,
      outputBundle.postProcess
    );
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
