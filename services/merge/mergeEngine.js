const ExcelJS = require("exceljs");
const { AppError, ErrorCodes } = require("../split/errors");
const {
  copyWorksheetMeta,
  copyHeaderRowsWithMerges,
} = require("../split/styleCopier");
const { extractConditionalFormattingNodes } = require("../optimize/zipUtils");
const { readWorkbook } = require("../split/excelReader");
const { resolveSheetName } = require("../split/sheetNameMatcher");
const { normalizeHeaderName } = require("./mergeTypes");

function textValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "text"))
      return String(value.text || "");
    if (Object.prototype.hasOwnProperty.call(value, "result"))
      return textValue(value.result);
    if (Object.prototype.hasOwnProperty.call(value, "richText")) {
      const parts = Array.isArray(value.richText) ? value.richText : [];
      return parts.map((item) => item.text || "").join("");
    }
    if (Object.prototype.hasOwnProperty.call(value, "error"))
      return String(value.error || "");
  }
  return String(value);
}

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (Array.isArray(value)) return value.map((item) => cloneValue(item));
  if (typeof value !== "object") return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return { ...value };
}

function normalizeCellValue(value) {
  if (value && typeof value === "object") {
    // Strip formula/sharedFormula metadata 锟�?only keep the cached result
    if (
      Object.prototype.hasOwnProperty.call(value, "sharedFormula") ||
      Object.prototype.hasOwnProperty.call(value, "formula")
    ) {
      if (Object.prototype.hasOwnProperty.call(value, "result")) {
        return cloneValue(value.result);
      }
      return null;
    }
    // Also strip raw formula objects where the whole value IS a formula
    const keys = Object.keys(value);
    if (
      keys.length === 4 &&
      keys.includes("formula") &&
      keys.includes("result") &&
      keys.includes("ref") &&
      keys.includes("shareType")
    ) {
      return cloneValue(value.result);
    }
  }
  return cloneValue(value);
}

function cloneStyle(styleValue) {
  if (!styleValue) return undefined;
  if (typeof structuredClone === "function") return structuredClone(styleValue);
  return { ...styleValue };
}

function copyCellStyle(styleCell, targetCell) {
  targetCell.numFmt = styleCell.numFmt || undefined;
  targetCell.alignment = cloneStyle(styleCell.alignment);
  targetCell.font = cloneStyle(styleCell.font);
  targetCell.fill = cloneStyle(styleCell.fill);
  targetCell.border = cloneStyle(styleCell.border);
  targetCell.protection = cloneStyle(styleCell.protection);
}

/**
 * 缁熶竴浠庡崟鍏冩牸璇诲彇鍒楀ご锛欴ate鈫扢M-DD锛屾枃鏈啋normalizeHeaderName
 * 锟�?excelReader.js 锟�?getHeadersFromWorksheet 淇濇寔瀹屽叏涓€锟�?
 */
function readHeaderFromCell(cell) {
  const value = cell.value;
  if (value instanceof Date) {
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${m}-${d}`;
  }
  if (value && typeof value === "object" && value.result instanceof Date) {
    const dt = value.result;
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${m}-${d}`;
  }
  return normalizeHeaderName(textValue(value));
}

function resolveHeaderMap(sheet, headerRows) {
  const columnsByHeader = resolveHeaderColumns(sheet, headerRows);
  const map = new Map();
  for (const [header, cols] of columnsByHeader.entries()) {
    if (cols.length > 0) map.set(header, cols[0]);
  }
  return map;
}

function resolveHeaderColumns(sheet, headerRows) {
  const map = new Map();
  const maxCol = Math.max(
    sheet.columnCount || 1,
    sheet.getRow(headerRows).cellCount || 1
  );
  for (let col = 1; col <= maxCol; col += 1) {
    let header = "";
    for (let row = headerRows; row >= 1; row -= 1) {
      const h = readHeaderFromCell(sheet.getRow(row).getCell(col));
      if (h) {
        header = h;
        break;
      }
    }
    if (!header) continue;
    if (!map.has(header)) map.set(header, []);
    map.get(header).push(col);
  }
  return map;
}

/**
 * 鎵鹃浂濉厖鑼冨洿锛氫粠"涓婃湀缁撳瓨"鎵€鍦ㄥ垪锟�?鍙敤缁撳瓨"鍒楋紙鍚級锛岀┖鐧藉～ 0
 */
function resolveZeroFillRange(templateSheet, headerRows) {
  const headerMap = resolveHeaderMap(templateSheet, headerRows);
  const availableBalanceCol =
    headerMap.get("\u53ef\u7528\u7ed3\u5b58") ||
    headerMap.get("\u53ef\u7528\u7ed3\u4f59") ||
    -1;
  if (availableBalanceCol < 1)
    return { zeroFillStartColumnIndex: -1, availableBalanceColumnIndex: -1 };

  let startCol = -1;
  for (const [name, col] of headerMap.entries()) {
    if (col >= availableBalanceCol) continue;
    if (name.includes("\u4e0a\u6708\u7ed3\u5b58")) {
      if (startCol === -1 || col < startCol) startCol = col;
    }
  }

  return {
    zeroFillStartColumnIndex: startCol,
    availableBalanceColumnIndex: availableBalanceCol,
  };
}

function resolveSequenceColumn(templateSheet, headerRows) {
  for (let rowNum = 1; rowNum <= headerRows; rowNum += 1) {
    const row = templateSheet.getRow(rowNum);
    let found = -1;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (normalizeHeaderName(textValue(cell.value)) === "\u5e8f\u53f7")
        found = colNumber;
    });
    if (found > 0) return found;
  }
  return -1;
}

function mapSourceToTargetColumns(rule, sourceSheet, templateSheet) {
  const sourceHeaders = resolveHeaderColumns(sourceSheet, rule.headerRows);
  const targetHeaders = resolveHeaderColumns(templateSheet, rule.headerRows);
  const colMap = new Map();

  for (const [sourceHeader, sourceCols] of sourceHeaders.entries()) {
    if (rule.removeHeaderSet.has(sourceHeader)) continue;
    const mappedHeader = rule.aliasMap.get(sourceHeader) || sourceHeader;
    const targetCols = targetHeaders.get(mappedHeader);
    if (!targetCols?.length) continue;

    const count = Math.min(sourceCols.length, targetCols.length);
    for (let i = 0; i < count; i += 1) {
      colMap.set(sourceCols[i], targetCols[i]);
    }
  }
  return colMap;
}

function buildOrderList(templateSheet, headerRows, orderColumnIndex) {
  const order = [];
  const seen = new Set();
  for (
    let rowNum = headerRows + 1;
    rowNum <= templateSheet.rowCount;
    rowNum += 1
  ) {
    const vendor = textValue(
      templateSheet.getRow(rowNum).getCell(orderColumnIndex).value
    ).trim();
    if (!vendor || seen.has(vendor)) continue;
    seen.add(vendor);
    order.push(vendor);
  }
  return order;
}

function resolveOrderRule(rules, mergeConfig) {
  const orderSheetName = mergeConfig.orderSheetName || "\u65e5\u62a5";
  const target = rules.find(
    (rule) =>
      rule.outputSheetName === orderSheetName ||
      rule.sheetName === orderSheetName
  );
  if (!target) {
    throw new AppError(
      ErrorCodes.INVALID_RULES,
      `Order source sheet "${orderSheetName}" is not configured in mergeSheetRules.`
    );
  }
  return target;
}

async function collectSheetRowsByVendor(
  sourceFiles,
  ruleContexts,
  logger,
  mergeConfig
) {
  const sheetRows = new Map();

  for (const context of ruleContexts) {
    sheetRows.set(context.outputSheetName, {
      vendorRows: new Map(),
      unknownOrder: [],
    });
  }

  for (const filePath of sourceFiles) {
    logger.info("Reading merge source workbook.", { filePath });
    const workbook = await readWorkbook(filePath);
    const actualSheetNames = workbook.worksheets.map((sheet) => sheet.name);

    for (const context of ruleContexts) {
      const resolved = resolveSheetName(
        context.sheetName,
        actualSheetNames,
        mergeConfig?.sheetNameAliases || {}
      );
      const sourceSheet = resolved.matchedSheetName
        ? workbook.getWorksheet(resolved.matchedSheetName)
        : null;
      if (!sourceSheet) continue;

      const rowsState = sheetRows.get(context.outputSheetName);
      const vendorRows = rowsState.vendorRows;
      const unknownOrder = rowsState.unknownOrder;
      const seenUnknown = new Set(unknownOrder);
      const colMap = mapSourceToTargetColumns(
        context,
        sourceSheet,
        context.templateSheet
      );

      for (
        let rowNum = context.headerRows + 1;
        rowNum <= sourceSheet.rowCount;
        rowNum += 1
      ) {
        const sourceRow = sourceSheet.getRow(rowNum);
        const vendor = textValue(
          sourceRow.getCell(context.splitColumnIndex).value
        ).trim();
        if (!vendor) {
          /* 绌虹櫧渚涘簲鍟嗚烦锟�?*/ continue;
        }
        const vendorKey = vendor;

        const valuesByCol = new Map();
        for (const [sourceCol, targetCol] of colMap.entries()) {
          const value = normalizeCellValue(sourceRow.getCell(sourceCol).value);
          valuesByCol.set(targetCol, value);
        }

        if (!vendorRows.has(vendorKey)) vendorRows.set(vendorKey, []);
        vendorRows.get(vendorKey).push(valuesByCol);

        if (!context.orderSet.has(vendorKey) && !seenUnknown.has(vendorKey)) {
          unknownOrder.push(vendorKey);
          seenUnknown.add(vendorKey);
        }
      }
    }
  }

  // 缁熻杈撳嚭
  for (const [name, state] of sheetRows) {
    let blank = 0,
      total = 0;
    for (const [vendor, rows] of state.vendorRows) {
      total += rows.length;
      if (!vendor) blank += rows.length;
    }
  }
  return sheetRows;
}

function orderedVendorsForSheet(
  vendorRows,
  orderList,
  unknownOrder,
  appendUnknown
) {
  const ordered = [];
  const rowKeys = new Set(vendorRows.keys());
  for (const vendor of orderList) {
    if (rowKeys.has(vendor)) ordered.push(vendor);
  }
  if (appendUnknown) {
    for (const vendor of unknownOrder) {
      if (rowKeys.has(vendor)) ordered.push(vendor);
    }
  }
  return ordered;
}

function safeCellValue(sourceCell) {
  const val = sourceCell.value;
  if (!val || typeof val !== "object") return cloneValue(val);
  if (
    Object.prototype.hasOwnProperty.call(val, "sharedFormula") ||
    Object.prototype.hasOwnProperty.call(val, "formula")
  ) {
    if (Object.prototype.hasOwnProperty.call(val, "result")) {
      return cloneValue(val.result);
    }
    return null;
  }
  return cloneValue(val);
}

/** Copy first N column widths from template, no cell data. */
function copyColumnWidths(templateSheet, outputSheet) {
  const MAX_COLS = 20;
  const cols = (templateSheet.columns || []).slice(0, MAX_COLS).map((col) => ({
    width: col.width,
    key: col.key,
    hidden: col.hidden,
    outlineLevel: col.outlineLevel,
  }));
  if (cols.length > 0) outputSheet.columns = cols;
}

/** Create a non-data sheet: column widths only (no row copying at all). */
function createPassthroughSheet(templateSheet, outputSheet) {
  copyColumnWidths(templateSheet, outputSheet);
  // Intentionally NOT copying header rows or merges to avoid shared formula issues
}

function isBlankOrZeroCellValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "number") return value === 0;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" || trimmed === "0";
  }
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "result")) {
      return isBlankOrZeroCellValue(value.result);
    }
    if (Object.prototype.hasOwnProperty.call(value, "text")) {
      return isBlankOrZeroCellValue(value.text);
    }
    if (Object.prototype.hasOwnProperty.call(value, "richText")) {
      const text = (Array.isArray(value.richText) ? value.richText : [])
        .map((item) => item.text || "")
        .join("");
      return isBlankOrZeroCellValue(text);
    }
  }
  return false;
}

function trimTrailingVendorlessRows(outputSheet, context) {
  const startRow = Number(context?.headerRows || 0) + 1;
  const vendorCol = Number(context?.splitColumnIndex || 0);
  if (!vendorCol || outputSheet.rowCount < startRow) {
    return 0;
  }

  let removed = 0;
  for (let rowNum = outputSheet.rowCount; rowNum >= startRow; rowNum -= 1) {
    const row = outputSheet.getRow(rowNum);
    const vendor = textValue(row.getCell(vendorCol).value).trim();
    if (vendor) break;

    outputSheet.spliceRows(rowNum, 1);
    removed += 1;
  }

  return removed;
}

function resolveTemplateStyleRow(templateSheet, headerRows, targetRowNum) {
  const firstDataRowNum = Number(headerRows || 0) + 1;
  if (targetRowNum > 0 && targetRowNum <= (templateSheet.rowCount || 0)) {
    return templateSheet.getRow(targetRowNum);
  }
  return (
    templateSheet.getRow(firstDataRowNum) ||
    templateSheet.getRow(Number(headerRows || 0))
  );
}

function writeMergedSheet(outputSheet, context, sheetRowsState, mergeConfig) {
  copyWorksheetMeta(context.templateSheet, outputSheet, context.templateSheet);
  copyHeaderRowsWithMerges(
    context.templateSheet,
    outputSheet,
    context.headerRows,
    context.templateSheet
  );

  const orderedVendors = orderedVendorsForSheet(
    sheetRowsState.vendorRows,
    context.orderList,
    sheetRowsState.unknownOrder,
    mergeConfig.appendUnknownVendorsToEnd !== false
  );

  let seq = 0;
  // Compute max column from actual data 锟�?template may have 2570 cols but data ~11
  let dataMaxCol = 0;
  for (const rows of sheetRowsState.vendorRows.values()) {
    for (const rowMap of rows) {
      for (const col of rowMap.keys()) {
        if (col > dataMaxCol) dataMaxCol = col;
      }
    }
  }
  const templateMaxCol = Math.max(
    dataMaxCol,
    context.sequenceColumnIndex || 0,
    context.templateSheet.columnCount || 1
  );

  for (const vendor of orderedVendors) {
    const rows = sheetRowsState.vendorRows.get(vendor) || [];
    for (const rowMap of rows) {
      const outRow = outputSheet.getRow(outputSheet.rowCount + 1);
      const templateStyleRow = resolveTemplateStyleRow(
        context.templateSheet,
        context.headerRows,
        outRow.number
      );
      outRow.height = templateStyleRow.height;
      for (let col = 1; col <= templateMaxCol; col += 1) {
        const styleCell = templateStyleRow.getCell(col);
        const outCell = outRow.getCell(col);
        let value = rowMap.has(col) ? rowMap.get(col) : null;

        // 闆跺～鍏咃細锟�?涓婃湀缁撳瓨"锟�?鍙敤缁撳瓨"锛堝惈锛夛紝绌虹櫧锟�?0
        if (
          value == null &&
          context.zeroFillStartColumnIndex > 0 &&
          col >= context.zeroFillStartColumnIndex &&
          col <= context.availableBalanceColumnIndex
        ) {
          value = 0;
        }

        if (context.sequenceColumnIndex === col) {
          seq += 1;
          value = seq;
        }
        outCell.value = value;
        copyCellStyle(styleCell, outCell);
      }
    }
  }

  trimTrailingVendorlessRows(outputSheet, {
    headerRows: context.headerRows,
    splitColumnIndex: context.splitColumnIndex,
    sequenceColumnIndex: context.sequenceColumnIndex,
    dataColumnCount: templateMaxCol,
  });
}

async function runMergeEngine({
  sourceFiles,
  templateWorkbook,
  templateSheetXmlMap,
  templateDifferentialStylesNode,
  rules,
  mergeConfig,
  logger,
  reportProgress,
}) {
  const ruleContexts = rules.map((rule) => {
    const templateSheet = templateWorkbook.getWorksheet(rule.outputSheetName);
    if (!templateSheet) {
      throw new AppError(
        ErrorCodes.SHEET_NOT_FOUND,
        `Template sheet "${rule.outputSheetName}" not found.`,
        { sheetName: rule.outputSheetName }
      );
    }
    const { zeroFillStartColumnIndex, availableBalanceColumnIndex } =
      resolveZeroFillRange(templateSheet, rule.headerRows);
    return {
      ...rule,
      templateSheet,
      templateConditionalFormattingNodes: extractConditionalFormattingNodes(
        templateSheetXmlMap?.get(rule.outputSheetName)?.xml || null
      ),
      sequenceColumnIndex: resolveSequenceColumn(
        templateSheet,
        rule.headerRows
      ),
      zeroFillStartColumnIndex,
      availableBalanceColumnIndex,
      orderList: [],
      orderSet: new Set(),
    };
  });

  const orderRule = resolveOrderRule(ruleContexts, mergeConfig);
  const orderColumnIndex =
    mergeConfig.orderColumnIndex || orderRule.splitColumnIndex;
  orderRule.orderList = buildOrderList(
    orderRule.templateSheet,
    orderRule.headerRows,
    orderColumnIndex
  );
  orderRule.orderSet = new Set(orderRule.orderList);
  for (const context of ruleContexts) {
    if (context === orderRule) continue;
    context.orderList = orderRule.orderList;
    context.orderSet = orderRule.orderSet;
  }

  reportProgress(20, "Collecting source rows");
  const sheetRows = await collectSheetRowsByVendor(
    sourceFiles,
    ruleContexts,
    logger,
    mergeConfig
  );

  const totalRows = [...sheetRows.values()].reduce((acc, state) => {
    let count = 0;
    for (const rows of state.vendorRows.values()) count += rows.length;
    return acc + count;
  }, 0);

  reportProgress(70, "Building merged workbook");
  const outputBook = new ExcelJS.Workbook();
  const sheetTransforms = {};
  for (const templateSheet of templateWorkbook.worksheets) {
    // 闅愯棌 sheet 涓嶅姞鍏ュ悎锟�?
    if (templateSheet.state === "hidden") continue;

    const outputSheet = outputBook.addWorksheet(templateSheet.name);
    const context = ruleContexts.find(
      (rule) => rule.outputSheetName === templateSheet.name
    );
    if (!context) {
      createPassthroughSheet(templateSheet, outputSheet, 1);
      sheetTransforms[templateSheet.name] = {
        normalizeView: { clearFrozenPane: true },
      };
      continue;
    }
    writeMergedSheet(
      outputSheet,
      context,
      sheetRows.get(context.outputSheetName),
      mergeConfig
    );
    sheetTransforms[context.outputSheetName] = {
      conditionalFormatting: {
        mode: "clip",
        nodes: context.templateConditionalFormattingNodes,
      },
      normalizeView: { clearFrozenPane: true },
      trimTrailingRows: true,
    };
  }

  reportProgress(100, "Completed");

  return {
    workbook: outputBook,
    postProcess: {
      sheetTransforms,
      stylesTransform: {
        differentialStylesNode: templateDifferentialStylesNode,
      },
    },
    stats: {
      sourceFileCount: sourceFiles.length,
      mergedRowCount: totalRows,
      vendorCount: orderRule.orderList.length,
    },
  };
}

module.exports = {
  runMergeEngine,
  // 浠ヤ笅涓烘祴璇曠敤鐨勫唴閮ㄥ嚱鏁板锟�?
  normalizeCellValue,
  cloneValue,
  cloneStyle,
  copyCellStyle,
  readHeaderFromCell,
  resolveHeaderMap,
  resolveSequenceColumn,
  mapSourceToTargetColumns,
  buildOrderList,
  resolveOrderRule,
  orderedVendorsForSheet,
  resolveTemplateStyleRow,
  trimTrailingVendorlessRows,
  textValue,
};
