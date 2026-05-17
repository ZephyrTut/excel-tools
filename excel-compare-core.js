const ExcelJS = require("exceljs");

const ZERO_FILL_KEYWORDS = ["入库", "出库", "领跑良品退回", "零跑退回良品"];

function stableStringify(value) {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function toText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" && value.trim().toUpperCase() === "#N/A") {
    return "0";
  }
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "error")) {
      return value.error === "#N/A" ? "0" : String(value.error || "");
    }
    if (Object.prototype.hasOwnProperty.call(value, "result")) {
      return toText(value.result);
    }
    if (Object.prototype.hasOwnProperty.call(value, "text")) {
      return String(value.text || "");
    }
    if (Object.prototype.hasOwnProperty.call(value, "richText")) {
      const richText = Array.isArray(value.richText) ? value.richText : [];
      return richText.map((run) => run.text || "").join("");
    }
  }
  return String(value);
}

function inferHeaderRows(sheet) {
  for (let r = 1; r <= 6; r += 1) {
    const row = sheet.getRow(r);
    let found = false;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (toText(cell.value).replace(/\s+/g, "") === "序号") found = true;
    });
    if (found) return r;
  }
  return 1;
}

function resolveZeroFillColumns(sheet, headerRows) {
  const result = new Set();
  for (let r = 1; r <= headerRows; r += 1) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const text = toText(cell.value).replace(/\s+/g, "");
      if (ZERO_FILL_KEYWORDS.some((k) => text.includes(k))) result.add(col);
    });
  }
  return result;
}

function resolvePreserveFillColumns(sheet, headerRows) {
  const result = new Set();
  const sheetName = String(sheet?.name || "").replace(/\s+/g, "");
  if (!sheetName.includes("日报")) return result;
  for (let r = 1; r <= headerRows; r += 1) {
    const row = sheet.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const text = toText(cell.value).replace(/\s+/g, "");
      if (text === "可用结存") result.add(col);
    });
  }
  if (result.size === 0) result.add(13);
  return result;
}

function columnLabel(col) {
  let colStr = "";
  let c = col;
  while (c > 0) {
    c -= 1;
    colStr = String.fromCharCode(65 + (c % 26)) + colStr;
    c = Math.floor(c / 26);
  }
  return colStr;
}

function cellAddress(row, col) {
  return `${columnLabel(col)}${row}`;
}

function usedBounds(sheet) {
  let maxCol = 1;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    maxCol = Math.max(maxCol, row.cellCount || 1);
  });
  maxCol = Math.max(maxCol, sheet.columnCount || 1);
  return {
    maxRow: Math.max(sheet.rowCount || 1, 1),
    maxCol
  };
}

function normalizedCellText(cell, row, col, zeroFillColumns, headerRows) {
  const raw = toText(cell.value).trim();
  if (row > headerRows && zeroFillColumns.has(col) && raw === "") return "0";
  return raw;
}

function getMerges(sheet) {
  const merges = sheet.model?.merges || [];
  return Array.isArray(merges) ? merges.slice().sort() : [];
}

async function loadWorkbook(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb;
}

async function compareWorkbooks(generatedFile, referenceFile) {
  const generated = await loadWorkbook(generatedFile);
  const reference = await loadWorkbook(referenceFile);
  const lines = [];
  const totals = {
    sheetNameDiffs: 0,
    valueDiffs: 0,
    headerStyleDiffs: 0,
    dataFillDiffs: 0,
    columnWidthDiffs: 0,
    rowHeightDiffs: 0,
    mergeDiffs: 0
  };

  lines.push(`生成文件: ${generatedFile}`);
  lines.push(`模板文件: ${referenceFile}`);
  lines.push("");
  lines.push(`Sheet 数: 生成 ${generated.worksheets.length}, 模板 ${reference.worksheets.length}`);

  const maxSheets = Math.max(generated.worksheets.length, reference.worksheets.length);
  for (let i = 0; i < maxSheets; i += 1) {
    const gs = generated.worksheets[i];
    const rs = reference.worksheets[i];
    const gName = gs?.name || "(missing)";
    const rName = rs?.name || "(missing)";
    const sheetTitle = `\n[Sheet ${i + 1}] 生成=${gName} | 模板=${rName}`;
    lines.push(sheetTitle);
    if (!gs || !rs) {
      totals.sheetNameDiffs += 1;
      continue;
    }
    if (gName !== rName) {
      totals.sheetNameDiffs += 1;
      lines.push(`  - 名称不一致`);
    }

    const headerRows = inferHeaderRows(rs);
    const zeroFillColumns = resolveZeroFillColumns(rs, headerRows);
    const preserveFillColumns = resolvePreserveFillColumns(rs, headerRows);
    const gb = usedBounds(gs);
    const rb = usedBounds(rs);
    const maxRow = Math.max(gb.maxRow, rb.maxRow);
    const maxCol = Math.max(gb.maxCol, rb.maxCol);
    lines.push(`  - 头部行数: ${headerRows}, 对比范围: ${maxRow}x${maxCol}`);

    const gMerges = getMerges(gs);
    const rMerges = getMerges(rs);
    if (stableStringify(gMerges) !== stableStringify(rMerges)) {
      totals.mergeDiffs += 1;
      lines.push(`  - 合并区域不一致 (生成 ${gMerges.length}, 模板 ${rMerges.length})`);
    }

    let sheetValueDiffs = 0;
    let sheetStyleDiffs = 0;
    let sheetFillDiffs = 0;
    let sheetColDiffs = 0;
    let sheetRowDiffs = 0;

    for (let col = 1; col <= maxCol; col += 1) {
      const gw = gs.getColumn(col).width || null;
      const rw = rs.getColumn(col).width || null;
      if (gw !== rw) {
        sheetColDiffs += 1;
        if (sheetColDiffs <= 20) {
          lines.push(`  - 列宽 ${columnLabel(col)}: 生成=${gw ?? "default"} 模板=${rw ?? "default"}`);
        }
      }
    }

    for (let row = 1; row <= maxRow; row += 1) {
      const gh = gs.getRow(row).height || null;
      const rh = rs.getRow(row).height || null;
      if (gh !== rh) {
        sheetRowDiffs += 1;
        if (sheetRowDiffs <= 20) {
          lines.push(`  - 行高 ${row}: 生成=${gh ?? "default"} 模板=${rh ?? "default"}`);
        }
      }
    }

    for (let row = 1; row <= maxRow; row += 1) {
      for (let col = 1; col <= maxCol; col += 1) {
        const gc = gs.getCell(row, col);
        const rc = rs.getCell(row, col);
        const gv = normalizedCellText(gc, row, col, zeroFillColumns, headerRows);
        const rv = normalizedCellText(rc, row, col, zeroFillColumns, headerRows);
        if (gv !== rv) {
          sheetValueDiffs += 1;
          if (sheetValueDiffs <= 80) {
            lines.push(`  - 值差异 ${cellAddress(row, col)}: 生成="${gv}" 模板="${rv}"`);
          }
        }

        if (row <= headerRows) {
          const gStyle = stableStringify({
            font: gc.font || null,
            fill: gc.fill || null,
            border: gc.border || null,
            alignment: gc.alignment || null,
            numFmt: gc.numFmt || null
          });
          const rStyle = stableStringify({
            font: rc.font || null,
            fill: rc.fill || null,
            border: rc.border || null,
            alignment: rc.alignment || null,
            numFmt: rc.numFmt || null
          });
          if (gStyle !== rStyle) {
            sheetStyleDiffs += 1;
            if (sheetStyleDiffs <= 80) {
              lines.push(`  - 表头样式差异 ${cellAddress(row, col)}`);
            }
          }
        } else if (preserveFillColumns.has(col)) {
          const gFill = stableStringify(gc.fill || null);
          const rFill = stableStringify(rc.fill || null);
          if (gFill !== rFill) {
            sheetFillDiffs += 1;
            if (sheetFillDiffs <= 80) {
              lines.push(`  - 数据底色差异 ${cellAddress(row, col)}`);
            }
          }
        }
      }
    }

    totals.valueDiffs += sheetValueDiffs;
    totals.headerStyleDiffs += sheetStyleDiffs;
    totals.dataFillDiffs += sheetFillDiffs;
    totals.columnWidthDiffs += sheetColDiffs;
    totals.rowHeightDiffs += sheetRowDiffs;
    lines.push(
      `  - 汇总: 值差异=${sheetValueDiffs}, 表头样式差异=${sheetStyleDiffs}, 数据底色差异=${sheetFillDiffs}, 列宽差异=${sheetColDiffs}, 行高差异=${sheetRowDiffs}`
    );
  }

  lines.push("\n=== 总结 ===");
  lines.push(`sheet 名称差异: ${totals.sheetNameDiffs}`);
  lines.push(`值差异: ${totals.valueDiffs}`);
  lines.push(`表头样式差异: ${totals.headerStyleDiffs}`);
  lines.push(`数据底色差异: ${totals.dataFillDiffs}`);
  lines.push(`列宽差异: ${totals.columnWidthDiffs}`);
  lines.push(`行高差异: ${totals.rowHeightDiffs}`);
  lines.push(`合并区域差异: ${totals.mergeDiffs}`);
  return { lines, totals };
}

module.exports = {
  compareWorkbooks
};
