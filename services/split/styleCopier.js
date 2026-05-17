function copyWorksheetMeta(sourceSheet, targetSheet) {
  targetSheet.properties = { ...sourceSheet.properties };
  targetSheet.pageSetup = { ...sourceSheet.pageSetup };
  targetSheet.views = sourceSheet.views ? [...sourceSheet.views] : [];
  targetSheet.state = sourceSheet.state;
  targetSheet.conditionalFormattings = sourceSheet.conditionalFormattings
    ? JSON.parse(JSON.stringify(sourceSheet.conditionalFormattings))
    : [];
  targetSheet.columns = (sourceSheet.columns || []).map((column) => ({
    key: column.key,
    width: column.width,
    hidden: column.hidden,
    outlineLevel: column.outlineLevel,
    style: column.style ? { ...column.style } : undefined,
  }));
}

function cloneCellValue(cell) {
  // Formula cells: keep cached value only; do not force 0 for blanks.
  if (cell.formula) {
    const r = cell.result;
    if (r === undefined) return null;
    return normalizeCopiedValue(clonePlainValue(r));
  }

  return normalizeCopiedValue(clonePlainValue(cell.value));
}

function clonePlainValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => clonePlainValue(item));

  // Common ExcelJS value types (hyperlink/richText/error/formula objects)
  if (Object.prototype.hasOwnProperty.call(value, "formula")) {
    return {
      formula: value.formula,
      result: clonePlainValue(value.result),
      ref: value.ref,
      shareType: value.shareType,
    };
  }
  if (Object.prototype.hasOwnProperty.call(value, "sharedFormula")) {
    return {
      sharedFormula: value.sharedFormula,
      result: clonePlainValue(value.result),
    };
  }
  if (Object.prototype.hasOwnProperty.call(value, "richText")) {
    return {
      richText: Array.isArray(value.richText)
        ? value.richText.map((run) => ({
            ...run,
            font: run?.font ? { ...run.font } : undefined,
          }))
        : [],
    };
  }
  if (
    Object.prototype.hasOwnProperty.call(value, "hyperlink") ||
    Object.prototype.hasOwnProperty.call(value, "text")
  ) {
    return {
      text: value.text,
      hyperlink: value.hyperlink,
      tooltip: value.tooltip,
    };
  }
  if (Object.prototype.hasOwnProperty.call(value, "error")) {
    return { error: value.error };
  }

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return { ...value };
}

function copyRowAndCells(sourceRow, targetSheet, targetRowNumber) {
  const zeroFillColumns = new Set();
  return copyRowAndCellsWithOptions(sourceRow, targetSheet, targetRowNumber, {
    zeroFillColumns,
  });
}

function copyRowAndCellsWithOptions(
  sourceRow,
  targetSheet,
  targetRowNumber,
  options = {}
) {
  const targetRow = targetSheet.getRow(targetRowNumber);
  const styleRow = options.styleRow || sourceRow;
  targetRow.height = styleRow.height || sourceRow.height;
  const zeroFillColumns = options.zeroFillColumns || new Set();
  const preserveSourceFillColumns = options.preserveSourceFillColumns || new Set();

  sourceRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const targetCell = targetRow.getCell(colNumber);
    const copiedValue = cloneCellValue(cell);
    const styleCell = styleRow.getCell(colNumber);
    targetCell.value = shouldForceZero(
      copiedValue,
      styleCell.value,
      colNumber,
      zeroFillColumns
    )
      ? 0
      : copiedValue;
    targetCell.numFmt = styleCell.numFmt || cell.numFmt || undefined;
    targetCell.alignment = styleCell.alignment
      ? { ...styleCell.alignment }
      : cell.alignment
        ? { ...cell.alignment }
        : undefined;
    targetCell.font = styleCell.font
      ? { ...styleCell.font }
      : cell.font
        ? { ...cell.font }
        : undefined;
    const useSourceFill = preserveSourceFillColumns.has(colNumber);
    targetCell.fill = cloneStyleObject(
      useSourceFill ? cell.fill : styleCell.fill || cell.fill
    );
    targetCell.border = cloneStyleObject(styleCell.border || cell.border);
    targetCell.protection = styleCell.protection
      ? { ...styleCell.protection }
      : cell.protection
      ? { ...cell.protection }
      : undefined;
  });
}

function shouldForceZero(value, templateValue, colNumber, zeroFillColumns) {
  if (!zeroFillColumns || zeroFillColumns.size === 0) return false;
  if (!zeroFillColumns.has(colNumber)) return false;
  if (templateValue === 0 || templateValue === "0") {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
  }
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

function normalizeCopiedValue(value) {
  if (typeof value === "string" && value.trim().toUpperCase() === "#N/A") {
    return 0;
  }
  if (
    value &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, "error")
  ) {
    return value.error === "#N/A" ? 0 : value;
  }
  return value;
}

function cloneStyleObject(styleValue) {
  if (!styleValue) return undefined;
  if (typeof structuredClone === "function") return structuredClone(styleValue);
  return { ...styleValue };
}

function parseCellRef(cellRef) {
  const match = /^([A-Z]+)(\d+)$/.exec(cellRef);
  if (!match) return null;
  return {
    col: match[1],
    row: Number(match[2]),
  };
}

function parseMergeRange(range) {
  const [start, end] = range.split(":");
  const s = parseCellRef(start);
  const e = parseCellRef(end);
  if (!s || !e) return null;
  return {
    startCol: s.col,
    startRow: s.row,
    endCol: e.col,
    endRow: e.row,
  };
}

function copyHeaderRowsWithMerges(sourceSheet, targetSheet, headerRows) {
  for (let row = 1; row <= headerRows; row += 1) {
    copyRowAndCells(sourceSheet.getRow(row), targetSheet, row);
  }

  const merges = sourceSheet.model?.merges || [];
  for (const range of merges) {
    const parsed = parseMergeRange(range);
    if (!parsed) continue;
    if (parsed.endRow <= headerRows) {
      targetSheet.mergeCells(range);
    }
  }
}

function copySingleRowMerges(
  sourceSheet,
  targetSheet,
  sourceRowNum,
  targetRowNum
) {
  const merges = sourceSheet.model?.merges || [];
  for (const range of merges) {
    const parsed = parseMergeRange(range);
    if (!parsed) continue;
    if (parsed.startRow === sourceRowNum && parsed.endRow === sourceRowNum) {
      const targetRange = `${parsed.startCol}${targetRowNum}:${parsed.endCol}${targetRowNum}`;
      targetSheet.mergeCells(targetRange);
    }
  }
}

module.exports = {
  copyWorksheetMeta,
  copyRowAndCells,
  copyRowAndCellsWithOptions,
  copyHeaderRowsWithMerges,
  copySingleRowMerges,
};
