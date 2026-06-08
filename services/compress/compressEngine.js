/**
 * XLSX compression engine — works at the ZIP/XML level without ExcelJS.
 *
 * Strips self-closing styled cells, empty trailing rows, external links,
 * calcChain, and compacts col definitions to reduce file size.
 */
const path = require("node:path");
const fs = require("node:fs");
const {
  readXlsxEntries,
  writeXlsxFile,
  cleanupAndOverwriteXlsx,
} = require("../optimize/zipUtils");

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function colLetterToNum(col) {
  let n = 0;
  for (let i = 0; i < col.length; i++) n = n * 26 + (col.charCodeAt(i) - 64);
  return n;
}

function colNumToLetter(n) {
  let s = "";
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

// --------------------------------------------------------------------------
// Entry filtering
// --------------------------------------------------------------------------

/**
 * Check if a ZIP entry should be removed entirely.
 * Removes external links and calculation chain.
 */
function shouldRemovePath(fileName) {
  if (fileName.startsWith("xl/externalLinks/")) return true;
  if (fileName === "xl/calcChain.xml") return true;
  return false;
}

/**
 * Check if a path is a worksheet XML.
 * Matches xl/worksheets/sheetN.xml
 */
function isWorksheet(fileName) {
  return /^xl\/worksheets\/sheet\d+\.xml$/i.test(fileName);
}

// --------------------------------------------------------------------------
// Worksheet optimization
// --------------------------------------------------------------------------

/**
 * Optimize a single worksheet XML string:
 *  - Find data bounding box from cells with VALUES (not self-closing styled cells)
 *  - Strip self-closing styled cells outside the data box
 *  - Remove empty rows beyond data region
 *  - Compact <cols> definition, fix <dimension>
 */
function optimizeWorksheetXml(xml) {
  const dataMatch = xml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (!dataMatch) return xml;

  const sheetData = dataMatch[1];
  const beforeData = xml.slice(0, dataMatch.index);
  const afterData = xml.slice(dataMatch.index + dataMatch[0].length);

  // Find data bounding box from cells with VALUES (non-self-closing)
  let maxDataRow = 0;
  let maxDataCol = 0;
  const dataCellRe = /<c\s+r="([A-Z]+)(\d+)"[^>]*\/>|<c\s+r="([A-Z]+)(\d+)"[^>]*>/g;
  let cellMatch;
  while ((cellMatch = dataCellRe.exec(sheetData)) !== null) {
    if (cellMatch[3] === undefined) continue; // Skip self-closing (no value)
    const col = colLetterToNum(cellMatch[3]);
    const row = parseInt(cellMatch[4], 10);
    if (col > maxDataCol) maxDataCol = col;
    if (row > maxDataRow) maxDataRow = row;
  }

  if (maxDataRow === 0 || maxDataCol === 0) {
    return xml.replace(/<sheetData>[\s\S]*?<\/sheetData>/, "<sheetData/>");
  }

  // Remove self-closing styled cells beyond maxDataCol
  let newSheetData = sheetData.replace(
    /<c\s+r="([A-Z]+)(\d+)"[^>]*\/>/g,
    (full, colLetter) => (colLetterToNum(colLetter) > maxDataCol ? "" : full)
  );

  // Remove rows beyond maxDataRow that have NO data cells
  newSheetData = newSheetData.replace(
    /<row\s[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g,
    (full, rowNumStr, content) => {
      const rowNum = parseInt(rowNumStr, 10);
      if (rowNum <= maxDataRow) return full;
      const withoutStyled = content.replace(/<c\s[^>]*\/>/g, "").trim();
      if (withoutStyled.length > 0) {
        maxDataRow = rowNum;
        return full;
      }
      return "";
    }
  );

  newSheetData = newSheetData.replace(/<row\s[^>]*>\s*<\/row>/g, "");

  const remainingMaxCol = [...newSheetData.matchAll(/([A-Z]+)(?=\d+")/g)].reduce(
    (max, m) => Math.max(max, colLetterToNum(m[1])),
    0
  );
  if (remainingMaxCol > 0) maxDataCol = remainingMaxCol;

  const rowCount = (newSheetData.match(/<\/row>/g) || []).length;
  const dimStr =
    maxDataCol > 0 && rowCount > 0
      ? `A1:${colNumToLetter(maxDataCol)}${rowCount}`
      : "A1";

  let result =
    beforeData + "<sheetData>" + newSheetData + "</sheetData>" + afterData;
  result = result.replace(
    /<dimension[^/]*\/>/,
    `<dimension ref="${dimStr}"/>`
  );

  // Compact <cols> definition
  if (maxDataCol > 0) {
    result = result.replace(/<cols>[\s\S]*?<\/cols>/, (match) => {
      const colDefs = [];
      for (const colMatch of match.matchAll(/<col[^>]*\/>/g)) {
        const tag = colMatch[0];
        const maxMatch = tag.match(/max="(\d+)"/);
        const colMax = maxMatch ? parseInt(maxMatch[1], 10) : 0;
        if (colMax <= maxDataCol) {
          colDefs.push(tag);
        } else {
          const minMatch = tag.match(/min="(\d+)"/);
          if (minMatch && parseInt(minMatch[1], 10) <= maxDataCol) {
            colDefs.push(tag.replace(/max="\d+"/, `max="${maxDataCol}"`));
          }
        }
      }
      return colDefs.length === 0 ? "" : "<cols>" + colDefs.join("") + "</cols>";
    });
  }

  return result;
}

// --------------------------------------------------------------------------
// Full compress pipeline
// --------------------------------------------------------------------------

/**
 * Full compress pipeline for a single xlsx file.
 *
 * @param {string} inputPath   Path to source xlsx
 * @param {string} outputPath  Path for compressed output
 * @param {Function} [onProgress]  Progress callback
 * @returns {Promise<{fileName, originalSize, optimizedSize, savingsPercent}>}
 */
async function optimizeOne(inputPath, outputPath, onProgress) {
  const stat = fs.statSync(inputPath);
  const originalSize = stat.size;

  const entries = await readXlsxEntries(inputPath);
  const optimized = new Map();

  for (const [fileName, data] of entries) {
    if (shouldRemovePath(fileName)) continue;
    if (onProgress) onProgress(0);

    if (isWorksheet(fileName) && typeof data === "string") {
      optimized.set(fileName, optimizeWorksheetXml(data));
    } else {
      optimized.set(fileName, data);
    }
  }

  // Clean [Content_Types].xml — remove externalLinks Override entries
  const ct = optimized.get("[Content_Types].xml");
  if (ct && typeof ct === "string") {
    optimized.set(
      "[Content_Types].xml",
      ct.replace(
        /<Override PartName="\/xl\/externalLinks\/[^"]*"[^/]*\/>\s*/g,
        ""
      )
    );
  }

  // Clean xl/_rels/workbook.xml.rels — remove externalLinks Relationship
  const rels = optimized.get("xl/_rels/workbook.xml.rels");
  if (rels && typeof rels === "string") {
    optimized.set(
      "xl/_rels/workbook.xml.rels",
      rels.replace(/<Relationship[^>]*externalLinks[^>]*\/>\s*/g, "")
    );
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await writeXlsxFile(outputPath, optimized);

  // Office compatibility post-processing
  const wbXml = entries.get("xl/workbook.xml") || "";
  const sheetTransforms = {};
  for (const m of String(wbXml).matchAll(/<sheet\s+name="([^"]+)"/g)) {
    sheetTransforms[m[1]] = {
      normalizeView: { clearFrozenPane: true },
      trimTrailingRows: true,
    };
  }
  await cleanupAndOverwriteXlsx(outputPath, { sheetTransforms });

  const outStat = fs.statSync(outputPath);
  const savingsPercent = (
    ((originalSize - outStat.size) / originalSize) *
    100
  ).toFixed(1);

  return {
    fileName: path.basename(inputPath),
    originalSize,
    optimizedSize: outStat.size,
    savingsPercent,
  };
}

module.exports = {
  optimizeOne,
  optimizeWorksheetXml,
};
