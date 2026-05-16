function copyWorksheetMeta(sourceSheet, targetSheet) {
  targetSheet.properties = { ...sourceSheet.properties };
  targetSheet.pageSetup = { ...sourceSheet.pageSetup };
  targetSheet.views = sourceSheet.views ? [...sourceSheet.views] : [];
  targetSheet.state = sourceSheet.state;
  targetSheet.columns = sourceSheet.columns.map((column) => ({
    key: column.key,
    width: column.width,
    hidden: column.hidden,
    outlineLevel: column.outlineLevel,
    style: column.style ? { ...column.style } : undefined
  }));
}

function cloneCellValue(cell) {
  const value = cell.value;
  if (value === null || value === undefined) return value;

  // ExcelJS shared formula clones can fail on write if the original master cell
  // is not present in the same relative position. Convert to normal formula.
  if (cell.formula) {
    return {
      formula: cell.formula,
      result: cell.result
    };
  }

  if (value instanceof Date) return new Date(value.getTime());
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (typeof value !== "object") return value;

  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function copyRowAndCells(sourceRow, targetSheet, targetRowNumber) {
  const targetRow = targetSheet.getRow(targetRowNumber);
  targetRow.height = sourceRow.height;

  sourceRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const targetCell = targetRow.getCell(colNumber);
    targetCell.value = cloneCellValue(cell);
    targetCell.style = cell.style ? JSON.parse(JSON.stringify(cell.style)) : {};
    targetCell.numFmt = cell.numFmt;
    targetCell.alignment = cell.alignment ? { ...cell.alignment } : undefined;
    targetCell.font = cell.font ? { ...cell.font } : undefined;
    targetCell.fill = cell.fill ? { ...cell.fill } : undefined;
    targetCell.border = cell.border ? { ...cell.border } : undefined;
    targetCell.protection = cell.protection ? { ...cell.protection } : undefined;
  });
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
  const [start, end] = range.split(":");
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

function copySingleRowMerges(sourceSheet, targetSheet, sourceRowNum, targetRowNum) {
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
  copyHeaderRowsWithMerges,
  copySingleRowMerges
};
