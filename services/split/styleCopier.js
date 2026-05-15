function cloneValue(v) {
  if (v === null || v === undefined) return v;
  if (typeof v !== 'object') return v;
  return JSON.parse(JSON.stringify(v));
}

function copyColumnMeta(sourceWs, targetWs) {
  sourceWs.columns.forEach((sourceColumn, idx) => {
    const targetColumn = targetWs.getColumn(idx + 1);
    targetColumn.width = sourceColumn.width;
    targetColumn.hidden = sourceColumn.hidden;
    targetColumn.outlineLevel = sourceColumn.outlineLevel;
    if (sourceColumn.style) targetColumn.style = cloneValue(sourceColumn.style);
  });
}

function copyRowStyle(sourceRow, targetRow) {
  targetRow.height = sourceRow.height;
  targetRow.hidden = sourceRow.hidden;
  targetRow.outlineLevel = sourceRow.outlineLevel;
  targetRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const sourceCell = sourceRow.getCell(colNumber);
    cell.style = cloneValue(sourceCell.style || {});
    if (sourceCell.numFmt) cell.numFmt = sourceCell.numFmt;
  });
}

function copyMerges(sourceWs, targetWs) {
  const modelMerges = sourceWs.model?.merges || [];
  modelMerges.forEach((range) => targetWs.mergeCells(range));
}

module.exports = { copyColumnMeta, copyRowStyle, copyMerges };
