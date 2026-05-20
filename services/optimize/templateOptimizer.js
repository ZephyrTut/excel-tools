/**
 * Template optimizer for large xlsx files.
 *
 * Problem: Some xlsx template files are 10-100MB+ due to:
 * - Empty styled cells written explicitly (<c r="X99" s="N"/>)
 * - Overly wide <cols> definitions (up to 16384 columns)
 * - Many empty rows with styled cells
 * - External links to other workbooks
 *
 * This module strips all that bloat at the ZIP/XML level so ExcelJS
 * can actually load the file without OOM.
 */
const { readXlsxEntries, writeXlsxFile } = require("./zipUtils");

/** Column letter → number (A=1, Z=26, AA=27, ...) */
function colLetterToNum(col) {
  let n = 0;
  for (let i = 0; i < col.length; i += 1) {
    n = n * 26 + (col.charCodeAt(i) - 64);
  }
  return n;
}

/** Number → column letter (1=A, 26=Z, 27=AA, ...) */
function colNumToLetter(n) {
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/**
 * Process a single worksheet XML string.
 *
 * Strategy:
 * 1. Scan for cells with actual VALUES (not self-closing) to determine
 *    the "data bounding box" (maxDataRow, maxDataCol).
 * 2. Only strip self-closing styled cells that lie OUTSIDE this box —
 *    cells inside the box carry template formatting and must be kept.
 * 3. Remove entire rows that are beyond maxDataRow and contain no data.
 * 4. Compact <cols> and fix <dimension> accordingly.
 *
 * Returns the optimized XML.
 */
function optimizeWorksheetXml(xml) {
  // 1. Extract the <sheetData>...</sheetData> section
  const dataMatch = xml.match(/<sheetData>(.*?)<\/sheetData>/s);
  if (!dataMatch) return xml;

  const sheetData = dataMatch[1];
  const beforeData = xml.slice(0, dataMatch.index);
  const afterData = xml.slice(dataMatch.index + dataMatch[0].length);

  // 2. Find the data bounding box from cells with actual VALUES.
  //    Self-closing:  <c r="A1" s="1"/>      → branch 1 (groups 1-2)
  //    With content:  <c r="A1" s="1"><v>1</v></c>  → branch 2 (groups 3-4)
  let maxDataRow = 0;
  let maxDataCol = 0;
  const dataCellRe = /<c\s+r="([A-Z]+)(\d+)"[^>]*\/>|<c\s+r="([A-Z]+)(\d+)"[^>]*>/g;
  let cellMatch;
  while ((cellMatch = dataCellRe.exec(sheetData)) !== null) {
    // Only branch 2 (non-self-closing) has data
    if (cellMatch[3] === undefined) continue;
    const col = colLetterToNum(cellMatch[3]);
    const row = parseInt(cellMatch[4], 10);
    if (col > maxDataCol) maxDataCol = col;
    if (row > maxDataRow) maxDataRow = row;
  }

  // No data at all → minimal worksheet
  if (maxDataRow === 0 || maxDataCol === 0) {
    return xml.replace(/<sheetData>.*<\/sheetData>/s, "<sheetData/>");
  }

  // 3. Remove self-closing cells that sit BEYOND maxDataCol.
  //    Cells within [1..maxDataCol] carry template formatting → keep them.
  let newSheetData = sheetData.replace(
    /<c\s+r="([A-Z]+)(\d+)"[^>]*\/>/g,
    (full, colLetter) => {
      const colNum = colLetterToNum(colLetter);
      return colNum > maxDataCol ? "" : full;
    }
  );

  // 4. Remove rows beyond maxDataRow that have no data cells.
  //    Rows ≤ maxDataRow are always kept (they are inside the data region).
  newSheetData = newSheetData.replace(
    /<row\s[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g,
    (full, rowNumStr, content) => {
      const rowNum = parseInt(rowNumStr, 10);
      if (rowNum <= maxDataRow) return full;
      // Beyond data range → strip all self-closing cells and check for data
      const withoutStyled = content.replace(/<c\s[^>]*\/>/g, "").trim();
      if (withoutStyled.length > 0) {
        // Has actual data cells → keep and extend maxDataRow
        if (rowNum > maxDataRow) maxDataRow = rowNum;
        return full;
      }
      return ""; // only styled cells → drop the whole row
    }
  );

  // 5. Remove rows that are now empty (all cells stripped)
  newSheetData = newSheetData.replace(/<row\s[^>]*>\s*<\/row>/g, "");

  // 6. Recalculate row count (remaining </row> tags)
  const rowCount = (newSheetData.match(/<\/row>/g) || []).length;

  // Update maxDataCol from remaining cells (step 3 may have trimmed the right edge)
  const cellRefs = newSheetData.match(/[A-Z]+(?=\d+")/g) || [];
  let remainingMaxCol = 0;
  for (const ref of cellRefs) {
    const n = colLetterToNum(ref);
    if (n > remainingMaxCol) remainingMaxCol = n;
  }
  if (remainingMaxCol > 0) maxDataCol = remainingMaxCol;

  // 7. Rebuild with updated dimension
  const dimStr = maxDataCol > 0 && rowCount > 0
    ? `A1:${colNumToLetter(maxDataCol)}${rowCount}`
    : "A1";
  let result = beforeData + "<sheetData>" + newSheetData + "</sheetData>" + afterData;
  result = result.replace(/<dimension[^/]*\/>/, `<dimension ref="${dimStr}"/>`);

  // 8. Compact <cols> to only cover columns with data
  if (maxDataCol > 0) {
    result = result.replace(
      /<cols>.*?<\/cols>/s,
      (match) => {
        const colDefs = [];
        const colRe = /<col[^>]*\/>/g;
        let colMatch;
        while ((colMatch = colRe.exec(match)) !== null) {
          const colTag = colMatch[0];
          const maxMatch = colTag.match(/max="(\d+)"/);
          const colMax = maxMatch ? parseInt(maxMatch[1], 10) : 0;
          if (colMax <= maxDataCol) {
            colDefs.push(colTag);
          } else {
            const minMatch = colTag.match(/min="(\d+)"/);
            const colMin = minMatch ? parseInt(minMatch[1], 10) : 0;
            if (colMin <= maxDataCol) {
              colDefs.push(colTag.replace(/max="\d+"/, `max="${maxDataCol}"`));
            }
          }
        }
        if (colDefs.length === 0) return "";
        return "<cols>" + colDefs.join("") + "</cols>";
      }
    );
  }

  return result;
}

/**
 * Check if a file should be removed during optimization.
 */
function shouldRemovePath(fileName) {
  if (fileName.startsWith("xl/externalLinks/")) return true;
  if (fileName === "xl/calcChain.xml") return true;
  return false;
}

/**
 * Check if this is a worksheet file.
 */
function isWorksheet(fileName) {
  return /^xl\/worksheets\/sheet\d+\.xml$/.test(fileName);
}

/**
 * Optimize a template xlsx file.
 *
 * Strips: empty styled cells, empty rows, over-wide column definitions,
 *         external links, calc chain.
 *
 * @param {string} inputPath  - Path to the original xlsx
 * @param {string} [outputPath] - Output path (defaults to overwriting input)
 * @returns {Promise<{originalSize: number, optimizedSize: number, savingsPercent: string}>}
 */
async function optimizeTemplate(inputPath, outputPath, onProgress) {
  const fs = require("fs");
  const stat = await fs.promises.stat(inputPath);
  const originalSize = stat.size;

  const entries = await readXlsxEntries(inputPath);
  const optimized = new Map();
  let processed = 0;
  const total = entries.length;

  for (const [fileName, data] of entries) {
    if (shouldRemovePath(fileName)) continue;
    processed++;
    if (onProgress) onProgress(processed / total);
    if (isWorksheet(fileName) && typeof data === "string") {
      optimized.set(fileName, optimizeWorksheetXml(data));
    } else {
      optimized.set(fileName, data);
    }
  }

  // Clean [Content_Types].xml: remove external link Override entries
  const ct = optimized.get("[Content_Types].xml");
  if (ct && typeof ct === "string") {
    optimized.set(
      "[Content_Types].xml",
      ct.replace(/<Override PartName="\/xl\/externalLinks\/[^"]*"[^/]*\/>\s*/g, "")
    );
  }

  // Clean xl/_rels/workbook.xml.rels: remove external link Relationships
  const relsPath = "xl/_rels/workbook.xml.rels";
  const rels = optimized.get(relsPath);
  if (rels && typeof rels === "string") {
    optimized.set(
      relsPath,
      rels.replace(/<Relationship[^>]*externalLinks[^>]*\/>\s*/g, "")
    );
  }

  const output = outputPath || inputPath;
  await writeXlsxFile(output, optimized);

  const outStat = await fs.promises.stat(output);
  const savingsPercent = (((originalSize - outStat.size) / originalSize) * 100).toFixed(1);

  return {
    originalSize,
    optimizedSize: outStat.size,
    savingsPercent,
  };
}

module.exports = {
  optimizeTemplate,
  optimizeWorksheetXml,
};
