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

function copyWorksheetMeta(sourceWs, targetWs) {
  targetWs.state = sourceWs.state;
  targetWs.properties = cloneValue(sourceWs.properties || {});
  targetWs.pageSetup = cloneValue(sourceWs.pageSetup || {});
  targetWs.headerFooter = cloneValue(sourceWs.headerFooter || {});
  targetWs.views = cloneValue(sourceWs.views || []);
  targetWs.autoFilter = cloneValue(sourceWs.autoFilter || null);

  if (sourceWs.model?.rowBreaks) targetWs.model.rowBreaks = cloneValue(sourceWs.model.rowBreaks);
  if (sourceWs.model?.colBreaks) targetWs.model.colBreaks = cloneValue(sourceWs.model.colBreaks);
}

function copyDataValidations(sourceWs, targetWs) {
  const validations = sourceWs.dataValidations?.model || {};
  targetWs.dataValidations.model = cloneValue(validations);
}

function copyConditionalFormatting(sourceWs, targetWs) {
  const modelCf = sourceWs.model?.conditionalFormattings;
  if (!Array.isArray(modelCf) || modelCf.length === 0) return;

  modelCf.forEach((cf) => {
    const cloned = cloneValue(cf);
    if (cloned?.ref && Array.isArray(cloned?.rules)) {
      targetWs.addConditionalFormatting(cloned);
    }
  });
}

module.exports = {
  copyColumnMeta,
  copyRowStyle,
  copyMerges,
  copyWorksheetMeta,
  copyDataValidations,
  copyConditionalFormatting
};
