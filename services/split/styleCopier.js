function copyWorksheetMeta(sourceSheet, targetSheet, templateSheet) {
  targetSheet.properties = { ...sourceSheet.properties };
  targetSheet.pageSetup = { ...sourceSheet.pageSetup };
  targetSheet.views = sourceSheet.views ? [...sourceSheet.views] : [];
  targetSheet.state = sourceSheet.state;
  targetSheet.conditionalFormattings = sourceSheet.conditionalFormattings
    ? JSON.parse(JSON.stringify(sourceSheet.conditionalFormattings)).filter((cf) => {
        // 移除那些设定"等于 0 时字体为白色"的条件格式规则——这会导致填充的 0 在视觉上消失
        if (!cf.rules) return true;
        cf.rules = cf.rules.filter((rule) => {
          if (
            rule.type === "cellIs" &&
            rule.operator === "equal" &&
            rule.formulae &&
            rule.formulae[0] === "0" &&
            rule.style &&
            rule.style.font &&
            rule.style.font.color &&
            rule.style.font.color.argb === "FFFFFFFF"
          ) {
            return false;
          }
          return true;
        });
        return cf.rules.length > 0;
      })
    : [];

  // Build column defaults: source first, then template overrides on top
  const srcCols = sourceSheet.columns || [];
  const tplCols = templateSheet?.columns || [];
  const maxCols = Math.max(srcCols.length, tplCols.length);
  targetSheet.columns = Array.from({ length: maxCols }, (_, i) => {
    const src = srcCols[i] || {};
    const tpl = tplCols[i] || {};
    return {
      key: tpl.key || src.key,
      width: tpl.width != null ? tpl.width : src.width,
      hidden: tpl.hidden != null ? tpl.hidden : src.hidden,
      outlineLevel: tpl.outlineLevel != null ? tpl.outlineLevel : src.outlineLevel,
      style: tpl.style ? { ...tpl.style } : (src.style ? { ...src.style } : undefined),
    };
  });
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

  // Ensure all columns are covered: source row cells + zero-fill columns beyond cellCount
  const _zeroCols = zeroFillColumns;
  const _maxCol = _zeroCols.size > 0 ? Math.max(sourceRow.cellCount, ..._zeroCols) : sourceRow.cellCount;
  for (let colNumber = 1; colNumber <= _maxCol; colNumber++) {
    const cell = sourceRow.getCell(colNumber);
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
    // Number format: use source cell's format if defined, else template/column
    targetCell.numFmt = (typeof cell.numFmt === 'string' && cell.numFmt)
      ? cell.numFmt
      : (options.styleRow && typeof styleCell.numFmt === 'string' && styleCell.numFmt)
        ? styleCell.numFmt
        : undefined;

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

    // Fill: preserve source fill for flagged columns (e.g. 可用结存).
    // Otherwise prefer template (styleRow) fill when available, falling
    // back to source fill — consistent with how font/alignment/numFmt work.
    const useSourceFill = preserveSourceFillColumns.has(colNumber);
    if (useSourceFill) {
      targetCell.fill = cloneStyleObject(cell.fill);
    } else {
      const tplFill = options.styleRow ? styleCell.fill : null;
      const hasExplicitTplFill = tplFill && typeof tplFill === 'object' &&
        tplFill.type === 'pattern' && tplFill.pattern !== 'none';
      if (hasExplicitTplFill) {
        targetCell.fill = cloneStyleObject(tplFill);
      } else {
        const srcFill = cell.fill;
        const hasExplicitFill = srcFill && typeof srcFill === 'object' &&
          srcFill.type === 'pattern' && srcFill.pattern !== 'none';
        if (hasExplicitFill) {
          targetCell.fill = cloneStyleObject(srcFill);
        }
        // else: inherit column default
      }
    }

    // Border: if source cell has explicit borders (non-empty), use them.
    // If no explicit border and template available, use template's border.
    const srcBorder = cell.border;
    const hasExplicitBorder = srcBorder && typeof srcBorder === 'object' && Object.keys(srcBorder).length > 0;
    if (hasExplicitBorder) {
      targetCell.border = cloneStyleObject(srcBorder);
    } else if (options.styleRow) {
      targetCell.border = cloneStyleObject(styleCell.border);
    }
    // else (no template, no explicit border): inherit column default
    targetCell.protection = styleCell.protection
      ? { ...styleCell.protection }
      : cell.protection
      ? { ...cell.protection }
      : undefined;
  }
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

function copyHeaderRowsWithMerges(sourceSheet, targetSheet, headerRows, styleSheet) {
  for (let row = 1; row <= headerRows; row += 1) {
    const styleRow = styleSheet ? styleSheet.getRow(row) : null;
    copyRowAndCellsWithOptions(sourceSheet.getRow(row), targetSheet, row, {
      zeroFillColumns: new Set(),
      styleRow: styleRow
    });
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
