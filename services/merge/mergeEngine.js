const ExcelJS = require("exceljs");
const { AppError, ErrorCodes } = require("../split/errors");
const { copyWorksheetMeta, copyHeaderRowsWithMerges } = require("../split/styleCopier");
const { readWorkbook } = require("../split/excelReader");
const { normalizeHeaderName } = require("./mergeTypes");

function textValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "text")) return String(value.text || "");
    if (Object.prototype.hasOwnProperty.call(value, "result")) return textValue(value.result);
    if (Object.prototype.hasOwnProperty.call(value, "richText")) {
      const parts = Array.isArray(value.richText) ? value.richText : [];
      return parts.map((item) => item.text || "").join("");
    }
    if (Object.prototype.hasOwnProperty.call(value, "error")) return String(value.error || "");
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
  if (value && typeof value === 'object') {
    // Strip formula/sharedFormula metadata �?only keep the cached result
    if (Object.prototype.hasOwnProperty.call(value, 'sharedFormula') ||
        Object.prototype.hasOwnProperty.call(value, 'formula')) {
      if (Object.prototype.hasOwnProperty.call(value, 'result')) {
        return cloneValue(value.result);
      }
      return null;
    }
    // Also strip raw formula objects where the whole value IS a formula
    const keys = Object.keys(value);
    if (keys.length === 4 && keys.includes('formula') && keys.includes('result') && keys.includes('ref') && keys.includes('shareType')) {
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
 * 统一从单元格读取列头：Date→MM-DD，文本→normalizeHeaderName
 * �?excelReader.js �?getHeadersFromWorksheet 保持完全一�?
 */
function readHeaderFromCell(cell) {
  const value = cell.value;
  if (value instanceof Date) {
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${m}-${d}`;
  }
  if (value && typeof value === 'object' && value.result instanceof Date) {
    const dt = value.result;
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${m}-${d}`;
  }
  return normalizeHeaderName(textValue(value));
}

function resolveHeaderMap(sheet, headerRows) {
  const map = new Map();
  const maxCol = Math.max(sheet.columnCount || 1, sheet.getRow(headerRows).cellCount || 1);
  for (let col = 1; col <= maxCol; col += 1) {
    let header = "";
    for (let row = headerRows; row >= 1; row -= 1) {
      const h = readHeaderFromCell(sheet.getRow(row).getCell(col));
      if (h) {
        header = h;
        break;
      }
    }
    if (header && !map.has(header)) map.set(header, col);
  }
  return map;
}

/**
 * 找零填充范围：从"上月结存"所在列�?可用结存"列（含），空白填 0
 */
function resolveZeroFillRange(templateSheet, headerRows) {
  const headerMap = resolveHeaderMap(templateSheet, headerRows);
  const availableBalanceCol = headerMap.get("可用结存") || headerMap.get("可用结余") || -1;
  if (availableBalanceCol < 1) return { zeroFillStartColumnIndex: -1, availableBalanceColumnIndex: -1 };

  let startCol = -1;
  for (const [name, col] of headerMap.entries()) {
    if (col >= availableBalanceCol) continue;
    if (name.includes("上月结存")) {
      if (startCol === -1 || col < startCol) startCol = col;
    }
  }

  return { zeroFillStartColumnIndex: startCol, availableBalanceColumnIndex: availableBalanceCol };
}

function resolveSequenceColumn(templateSheet, headerRows) {
  for (let rowNum = 1; rowNum <= headerRows; rowNum += 1) {
    const row = templateSheet.getRow(rowNum);
    let found = -1;
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (normalizeHeaderName(textValue(cell.value)) === "序号") found = colNumber;
    });
    if (found > 0) return found;
  }
  return -1;
}

function mapSourceToTargetColumns(rule, sourceSheet, templateSheet) {
  const sourceHeaders = resolveHeaderMap(sourceSheet, rule.headerRows);
  const targetHeaders = resolveHeaderMap(templateSheet, rule.headerRows);
  const colMap = new Map();

  for (const [sourceHeader, sourceCol] of sourceHeaders.entries()) {
    if (rule.removeHeaderSet.has(sourceHeader)) continue;
    const mappedHeader = rule.aliasMap.get(sourceHeader) || sourceHeader;
    const targetCol = targetHeaders.get(mappedHeader);
    if (!targetCol) continue;
    colMap.set(sourceCol, targetCol);
  }
  return colMap;
}

function buildOrderList(templateSheet, headerRows, orderColumnIndex) {
  const order = [];
  const seen = new Set();
  for (let rowNum = headerRows + 1; rowNum <= templateSheet.rowCount; rowNum += 1) {
    const vendor = textValue(templateSheet.getRow(rowNum).getCell(orderColumnIndex).value).trim();
    if (!vendor || seen.has(vendor)) continue;
    seen.add(vendor);
    order.push(vendor);
  }
  return order;
}

function resolveOrderRule(rules, mergeConfig) {
  const orderSheetName = mergeConfig.orderSheetName || "日报";
  const target = rules.find((rule) => rule.outputSheetName === orderSheetName || rule.sheetName === orderSheetName);
  if (!target) {
    throw new AppError(
      ErrorCodes.INVALID_RULES,
      `Order source sheet "${orderSheetName}" is not configured in sheetRules.`
    );
  }
  return target;
}

async function collectSheetRowsByVendor(sourceFiles, ruleContexts, logger) {
  const sheetRows = new Map();

  for (const context of ruleContexts) {
    sheetRows.set(context.outputSheetName, {
      vendorRows: new Map(),
      unknownOrder: []
    });
  }

  for (const filePath of sourceFiles) {
    logger.info("Reading merge source workbook.", { filePath });
    const workbook = await readWorkbook(filePath);

    for (const context of ruleContexts) {
      const sourceSheet = workbook.getWorksheet(context.sheetName);
      if (!sourceSheet) continue;

      const rowsState = sheetRows.get(context.outputSheetName);
      const vendorRows = rowsState.vendorRows;
      const unknownOrder = rowsState.unknownOrder;
      const seenUnknown = new Set(unknownOrder);
      const colMap = mapSourceToTargetColumns(context, sourceSheet, context.templateSheet);

      for (let rowNum = context.headerRows + 1; rowNum <= sourceSheet.rowCount; rowNum += 1) {
        const sourceRow = sourceSheet.getRow(rowNum);
        const vendor = textValue(sourceRow.getCell(context.splitColumnIndex).value).trim();
        if (!vendor) { /* 空白供应商跳�?*/ continue; }
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

    // 统计输出
  for (const [name, state] of sheetRows) {
    let blank = 0, total = 0;
    for (const [vendor, rows] of state.vendorRows) {
      total += rows.length;
      if (!vendor) blank += rows.length;
    }
  }
  return sheetRows;
}

function orderedVendorsForSheet(vendorRows, orderList, unknownOrder, appendUnknown) {
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
  if (!val || typeof val !== 'object') return cloneValue(val);
  if (Object.prototype.hasOwnProperty.call(val, 'sharedFormula') ||
      Object.prototype.hasOwnProperty.call(val, 'formula')) {
    if (Object.prototype.hasOwnProperty.call(val, 'result')) {
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
    outlineLevel: col.outlineLevel
  }));
  if (cols.length > 0) outputSheet.columns = cols;
}

/** Create a non-data sheet: column widths only (no row copying at all). */
function createPassthroughSheet(templateSheet, outputSheet) {
  copyColumnWidths(templateSheet, outputSheet);
  // Intentionally NOT copying header rows or merges to avoid shared formula issues
}

function writeMergedSheet(outputSheet, context, sheetRowsState, mergeConfig) {
  const orderedVendors = orderedVendorsForSheet(
    sheetRowsState.vendorRows,
    context.orderList,
    sheetRowsState.unknownOrder,
    mergeConfig.appendUnknownVendorsToEnd !== false
  );

  // 空 sheet：只复制列宽，不复制表头或合并单元格（避免 mergeCells 引用不存在的数据行导致 XML 报错）
  if (orderedVendors.length === 0) {
    copyColumnWidths(context.templateSheet, outputSheet);
    return;
  }

  copyWorksheetMeta(context.templateSheet, outputSheet, context.templateSheet);
  copyHeaderRowsWithMerges(
    context.templateSheet,
    outputSheet,
    context.headerRows,
    context.templateSheet
  );

  let seq = 0;
  const templateStyleRow =
    context.templateSheet.getRow(context.headerRows + 1) || context.templateSheet.getRow(context.headerRows);
  // Compute max column from actual data �?template may have 2570 cols but data ~11
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
      outRow.height = templateStyleRow.height;
      for (let col = 1; col <= templateMaxCol; col += 1) {
        const styleCell = templateStyleRow.getCell(col);
        const outCell = outRow.getCell(col);
        let value = rowMap.has(col) ? rowMap.get(col) : null;
        
        // 零填充：�?上月结存"�?可用结存"（含），空白�?0
        if (value == null &&
            context.zeroFillStartColumnIndex > 0 &&
            col >= context.zeroFillStartColumnIndex &&
            col <= context.availableBalanceColumnIndex) {
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
}

async function runMergeEngine({
  sourceFiles,
  templateWorkbook,
  rules,
  mergeConfig,
  logger,
  reportProgress
}) {
  const ruleContexts = rules
    .map((rule) => {
      const templateSheet = templateWorkbook.getWorksheet(rule.outputSheetName);
      if (!templateSheet) {
        throw new AppError(
          ErrorCodes.SHEET_NOT_FOUND,
          `Template sheet "${rule.outputSheetName}" not found.`,
          { sheetName: rule.outputSheetName }
        );
      }
      const { zeroFillStartColumnIndex, availableBalanceColumnIndex } = resolveZeroFillRange(templateSheet, rule.headerRows);
      return {
        ...rule,
        templateSheet,
        sequenceColumnIndex: resolveSequenceColumn(templateSheet, rule.headerRows),
        zeroFillStartColumnIndex,
        availableBalanceColumnIndex,
        orderList: [],
        orderSet: new Set()
      };
    });

  const orderRule = resolveOrderRule(ruleContexts, mergeConfig);
  const orderColumnIndex = mergeConfig.orderColumnIndex || orderRule.splitColumnIndex;
  orderRule.orderList = buildOrderList(orderRule.templateSheet, orderRule.headerRows, orderColumnIndex);
  orderRule.orderSet = new Set(orderRule.orderList);
  for (const context of ruleContexts) {
    if (context === orderRule) continue;
    context.orderList = orderRule.orderList;
    context.orderSet = orderRule.orderSet;
  }

  reportProgress(20, "Collecting source rows");
  const sheetRows = await collectSheetRowsByVendor(sourceFiles, ruleContexts, logger);

  const totalRows = [...sheetRows.values()].reduce((acc, state) => {
    let count = 0;
    for (const rows of state.vendorRows.values()) count += rows.length;
    return acc + count;
  }, 0);

  reportProgress(70, "Building merged workbook");
  const outputBook = new ExcelJS.Workbook();

  // 第一轮：有数据规则匹配的 sheet（数据 sheet 排前面，用户打开不再看到空白）
  for (const context of ruleContexts) {
    const templateSheet = templateWorkbook.getWorksheet(context.outputSheetName);
    if (!templateSheet || templateSheet.state === 'hidden') continue;
    const outputSheet = outputBook.addWorksheet(templateSheet.name);
    writeMergedSheet(outputSheet, context, sheetRows.get(context.outputSheetName), mergeConfig);
  }

  // 第二轮：直通 sheet（无规则匹配的模板 sheet，排在数据 sheet 之后）
  for (const templateSheet of templateWorkbook.worksheets) {
    if (templateSheet.state === 'hidden') continue;
    if (ruleContexts.some((r) => r.outputSheetName === templateSheet.name)) continue;
    const outputSheet = outputBook.addWorksheet(templateSheet.name);
    createPassthroughSheet(templateSheet, outputSheet);
  }

  // 设置第一个 sheet 为激活状态
  if (outputBook.worksheets.length > 0) {
    outputBook.worksheets[0].active = true;
  }

  reportProgress(100, "Completed");

  return {
    workbook: outputBook,
    stats: {
      sourceFileCount: sourceFiles.length,
      mergedRowCount: totalRows,
      vendorCount: orderRule.orderList.length
    }
  };
}

module.exports = {
  runMergeEngine,
  // 以下为测试用的内部函数导�?
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
  textValue,
};
