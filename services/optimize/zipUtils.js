/**
 * ZIP utilities for xlsx post-processing.
 */
const fs = require("node:fs");
const AdmZip = require("adm-zip");

function cloneEntries(entriesMap) {
  return new Map(entriesMap);
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalizeZipTarget(target) {
  const raw = String(target || "").replace(/\\/g, "/");
  if (!raw) return "";
  if (raw.startsWith("/")) {
    return raw.replace(/^\/+/, "");
  }
  if (raw.startsWith("xl/")) {
    return raw;
  }
  return `xl/${raw.replace(/^\.?\/*/, "")}`;
}

/**
 * Read an xlsx file and return a Map of entry paths to their content.
 * XML/rels files are returned as strings; others as Buffers.
 */
async function readXlsxEntries(xlsxPath) {
  const fileBuffer = Buffer.isBuffer(xlsxPath) ? xlsxPath : fs.readFileSync(xlsxPath);
  const zip = new AdmZip(fileBuffer);
  const entries = zip.getEntries();
  const map = new Map();

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const data = entry.getData();
    const fullName = entry.entryName;
    const ext = fullName.split(".").pop().toLowerCase();
    if (["xml", "rels"].includes(ext)) {
      map.set(fullName, data.toString("utf8"));
    } else {
      map.set(fullName, data);
    }
  }
  return map;
}

/**
 * Write a Map of entries to an xlsx file.
 * entriesMap: { fileName -> string | Buffer | Uint8Array }
 */
async function writeXlsxFile(xlsxPath, entriesMap) {
  const zip = new AdmZip();

  const sorted = [...entriesMap.entries()].sort((a, b) => {
    if (a[0] === "[Content_Types].xml") return -1;
    if (b[0] === "[Content_Types].xml") return 1;
    return a[0].localeCompare(b[0]);
  });

  for (const [fileName, data] of sorted) {
    const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
    zip.addFile(fileName, buf);
  }

  zip.writeZip(xlsxPath);
}

function isWorksheetEntry(entryName) {
  return /^xl\/worksheets\/sheet\d+\.xml$/i.test(entryName);
}

function extractWorkbookSheetEntries(entriesMap) {
  const workbookXml = entriesMap.get("xl/workbook.xml");
  const workbookRels = entriesMap.get("xl/_rels/workbook.xml.rels");
  const result = new Map();
  if (typeof workbookXml !== "string" || typeof workbookRels !== "string") {
    return result;
  }

  const targetByRelId = new Map();
  for (const match of workbookRels.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/>/g)) {
    targetByRelId.set(match[1], normalizeZipTarget(match[2]));
  }

  for (const match of workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]+)"[^>]*\br:id="([^"]+)"[^>]*\/>/g)) {
    const sheetName = decodeXmlEntities(match[1]);
    const relId = match[2];
    const targetPath = targetByRelId.get(relId);
    if (!targetPath) continue;
    result.set(sheetName, {
      name: sheetName,
      relId,
      path: targetPath,
      xml: entriesMap.get(targetPath),
    });
  }

  return result;
}

async function readWorkbookSheetEntries(xlsxPath) {
  const entries = await readXlsxEntries(xlsxPath);
  return extractWorkbookSheetEntries(entries);
}

function columnToNumber(column) {
  return String(column || "")
    .toUpperCase()
    .split("")
    .reduce((sum, ch) => sum * 26 + (ch.charCodeAt(0) - 64), 0);
}

function numberToColumn(num) {
  let current = Math.max(1, Number(num) || 1);
  let out = "";
  while (current > 0) {
    const rem = (current - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    current = Math.floor((current - 1) / 26);
  }
  return out;
}

function parseCellRef(cellRef) {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(String(cellRef || "").trim());
  if (!match) return null;
  return {
    col: match[1].toUpperCase(),
    row: Number(match[2]),
  };
}

function formatCellRef(col, row) {
  return `${String(col || "").toUpperCase()}${Number(row)}`;
}

function formatRangeToken(startCol, startRow, endCol, endRow) {
  if (startCol === endCol && startRow === endRow) {
    return formatCellRef(startCol, startRow);
  }
  return `${formatCellRef(startCol, startRow)}:${formatCellRef(endCol, endRow)}`;
}

function parseRangeToken(token) {
  const [startToken, endToken] = String(token || "").split(":");
  const start = parseCellRef(startToken);
  const end = parseCellRef(endToken || startToken);
  if (!start || !end) return null;
  const startRow = Math.min(start.row, end.row);
  const endRow = Math.max(start.row, end.row);
  const startColNumber = Math.min(columnToNumber(start.col), columnToNumber(end.col));
  const endColNumber = Math.max(columnToNumber(start.col), columnToNumber(end.col));
  return {
    startCol: numberToColumn(startColNumber),
    endCol: numberToColumn(endColNumber),
    startRow,
    endRow,
  };
}

function uniqueSortedNumbers(numbers) {
  return [...new Set(numbers.map((item) => Number(item)).filter((item) => Number.isFinite(item)))].sort(
    (a, b) => a - b
  );
}

function numbersToSegments(numbers) {
  const sorted = uniqueSortedNumbers(numbers);
  if (sorted.length === 0) return [];

  const segments = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === prev + 1) {
      prev = current;
      continue;
    }
    segments.push([start, prev]);
    start = current;
    prev = current;
  }
  segments.push([start, prev]);
  return segments;
}

function normalizeRowMapEntries(rowMap) {
  if (!rowMap) return [];
  if (rowMap instanceof Map) {
    return [...rowMap.entries()]
      .map(([sourceRow, targetRow]) => [Number(sourceRow), Number(targetRow)])
      .filter(([sourceRow, targetRow]) => Number.isFinite(sourceRow) && Number.isFinite(targetRow))
      .sort((a, b) => a[0] - b[0]);
  }
  if (Array.isArray(rowMap)) {
    return rowMap
      .map(([sourceRow, targetRow]) => [Number(sourceRow), Number(targetRow)])
      .filter(([sourceRow, targetRow]) => Number.isFinite(sourceRow) && Number.isFinite(targetRow))
      .sort((a, b) => a[0] - b[0]);
  }
  return [];
}

function clipSqrefToken(token, maxRow) {
  const parsed = parseRangeToken(token);
  if (!parsed) return [];
  if (parsed.startRow > maxRow) return [];
  return [
    formatRangeToken(
      parsed.startCol,
      parsed.startRow,
      parsed.endCol,
      Math.min(parsed.endRow, maxRow)
    ),
  ];
}

function remapSqrefToken(token, rowMapEntries, maxRow, options = {}) {
  const parsed = parseRangeToken(token);
  if (!parsed) return [];

  const sourceMaxRow = Number(options.sourceMaxRow) || 0;
  const trailingRowPadding = Math.max(0, Number(options.trailingRowPadding) || 0);

  const mappedRows = [];
  for (const [sourceRow, targetRow] of rowMapEntries) {
    if (sourceRow < parsed.startRow || sourceRow > parsed.endRow) continue;
    if (Number.isFinite(maxRow) && maxRow > 0 && targetRow > maxRow) continue;
    mappedRows.push(targetRow);
  }

  const segments = numbersToSegments(mappedRows);
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    const shouldExtendTrailingRange =
      parsed.endRow > lastSegment[1] &&
      Number.isFinite(maxRow) &&
      maxRow > lastSegment[1];

    if (shouldExtendTrailingRange) {
      const extension =
        trailingRowPadding > 0 && parsed.endRow === sourceMaxRow
          ? trailingRowPadding
          : maxRow - lastSegment[1];
      lastSegment[1] += extension;
    }
  }

  return segments.map(([startRow, endRow]) =>
    formatRangeToken(
      parsed.startCol,
      startRow,
      parsed.endCol,
      Number.isFinite(maxRow) && maxRow > 0 ? Math.min(endRow, maxRow) : endRow
    )
  );
}

function replaceSqrefAttribute(nodeXml, sqrefValue) {
  return String(nodeXml).replace(/\bsqref="[^"]*"/, `sqref="${sqrefValue}"`);
}

function extractConditionalFormattingNodes(sheetXml) {
  return [...String(sheetXml || "").matchAll(/<conditionalFormatting\b[^>]*\/>|<conditionalFormatting\b[^>]*>[\s\S]*?<\/conditionalFormatting>/g)]
    .map((match) => match[0])
    .filter((nodeXml) => /\bsqref="[^"]+"/.test(nodeXml) && /<cfRule\b/.test(nodeXml));
}

function extractDifferentialStylesNode(stylesXml) {
  const match = /<dxfs\b[^>]*\/>|<dxfs\b[^>]*>[\s\S]*?<\/dxfs>/.exec(String(stylesXml || ""));
  return match ? match[0] : "";
}

function removeConditionalFormattingNodes(sheetXml) {
  return String(sheetXml || "").replace(
    /<conditionalFormatting\b[^>]*\/>|<conditionalFormatting\b[^>]*>[\s\S]*?<\/conditionalFormatting>/g,
    ""
  );
}

function rebuildConditionalFormattingNodes(nodes, options = {}) {
  const mode = options.mode || "clip";
  const maxRow = Number(options.maxRow) || 0;
  const rowMapEntries = normalizeRowMapEntries(options.rowMap);

  return (Array.isArray(nodes) ? nodes : [])
    .map((nodeXml) => {
      const sqrefMatch = /\bsqref="([^"]+)"/.exec(String(nodeXml || ""));
      if (!sqrefMatch) return null;
      const originalTokens = sqrefMatch[1].split(/\s+/).filter(Boolean);
      const rebuiltTokens = [];
      for (const token of originalTokens) {
        if (mode === "remap") {
          rebuiltTokens.push(
            ...remapSqrefToken(token, rowMapEntries, maxRow, {
              sourceMaxRow: Number(options.sourceMaxRow) || 0,
              trailingRowPadding: Number(options.trailingRowPadding) || 0,
            })
          );
        } else {
          rebuiltTokens.push(...clipSqrefToken(token, maxRow));
        }
      }
      const uniqueTokens = [...new Set(rebuiltTokens)];
      if (uniqueTokens.length === 0) return null;
      return replaceSqrefAttribute(nodeXml, uniqueTokens.join(" "));
    })
    .filter(Boolean);
}

function rowMatchesFromWorksheetXml(xml) {
  return [...String(xml || "").matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g)].map((match) => ({
    rowNumber: Number(match[1]),
    xml: match[0],
  }));
}

function findWorksheetMaxRow(xml) {
  return rowMatchesFromWorksheetXml(xml).reduce((max, row) => Math.max(max, row.rowNumber), 0);
}

function findWorksheetDeclaredMaxRow(xml) {
  const dimensionMatch = /<dimension\b[^>]*\bref="([^"]+)"/.exec(String(xml || ""));
  if (!dimensionMatch) return findWorksheetMaxRow(xml);
  const parsed = parseRangeToken(dimensionMatch[1]);
  return parsed ? parsed.endRow : findWorksheetMaxRow(xml);
}

function clampSqrefToken(token, maxRow) {
  const rebuilt = clipSqrefToken(token, maxRow);
  return rebuilt[0] || "";
}

function capConditionalFormattingRefs(xml, providedMaxRow) {
  const maxRow = Number(providedMaxRow) || findWorksheetMaxRow(xml);
  if (maxRow <= 0) return xml;

  return String(xml).replace(
    /(<conditionalFormatting\b[^>]*\ssqref=")([^"]+)(")/g,
    (_full, prefix, refValue, suffix) => {
      const capped = String(refValue)
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => clampSqrefToken(token, maxRow))
        .filter(Boolean)
        .join(" ");
      return capped ? `${prefix}${capped}${suffix}` : "";
    }
  );
}

function findWorksheetDimensionRange(xml) {
  const dimensionMatch = /<dimension\b[^>]*\bref="([^"]+)"/.exec(String(xml || ""));
  if (!dimensionMatch) return null;
  return parseRangeToken(dimensionMatch[1]);
}

function clipSqrefTokenToRange(token, range) {
  const parsed = parseRangeToken(token);
  if (!parsed || !range) return [];
  if (parsed.startRow > range.endRow || columnToNumber(parsed.startCol) > columnToNumber(range.endCol)) {
    return [];
  }

  const endRow = Math.min(parsed.endRow, range.endRow);
  const endColNumber = Math.min(columnToNumber(parsed.endCol), columnToNumber(range.endCol));
  const startColNumber = columnToNumber(parsed.startCol);
  if (endColNumber < startColNumber) return [];

  return [
    formatRangeToken(
      parsed.startCol,
      parsed.startRow,
      numberToColumn(endColNumber),
      endRow
    ),
  ];
}

function capDataValidationRefs(xml) {
  const range = findWorksheetDimensionRange(xml);
  if (!range) return xml;

  return String(xml || "").replace(
    /<dataValidations\b[^>]*>[\s\S]*?<\/dataValidations>|<dataValidations\b[^>]*\/>/g,
    (blockXml) => {
      const rebuiltNodes = [];
      const validationNodeRe = /<dataValidation\b[^>]*\/>|<dataValidation\b[^>]*>[\s\S]*?<\/dataValidation>/g;

      for (const match of blockXml.matchAll(validationNodeRe)) {
        const nodeXml = match[0];
        const sqrefMatch = /\bsqref="([^"]+)"/.exec(nodeXml);
        if (!sqrefMatch) continue;

        const capped = sqrefMatch[1]
          .split(/\s+/)
          .filter(Boolean)
          .flatMap((token) => clipSqrefTokenToRange(token, range));
        const uniqueTokens = [...new Set(capped)];
        if (uniqueTokens.length === 0) continue;

        rebuiltNodes.push(replaceSqrefAttribute(nodeXml, uniqueTokens.join(" ")));
      }

      if (rebuiltNodes.length === 0) return "";

      const openTagMatch = /^<dataValidations\b[^>]*>/.exec(blockXml);
      let openTag = openTagMatch ? openTagMatch[0] : "<dataValidations>";
      openTag = setOrReplaceAttribute(openTag, "count", String(rebuiltNodes.length));
      return `${openTag}${rebuiltNodes.join("")}</dataValidations>`;
    }
  );
}

function collectProtectedRowRanges(xml) {
  const ranges = [];

  for (const match of String(xml || "").matchAll(/<mergeCell\b[^>]*\bref="([^"]+)"/g)) {
    const parsed = parseRangeToken(match[1]);
    if (!parsed) continue;
    ranges.push([parsed.startRow, parsed.endRow]);
  }

  for (const match of String(xml || "").matchAll(/<conditionalFormatting\b[^>]*\bsqref="([^"]+)"/g)) {
    const tokens = String(match[1]).split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const parsed = parseRangeToken(token);
      if (!parsed) continue;
      ranges.push([parsed.startRow, parsed.endRow]);
    }
  }

  for (const match of String(xml || "").matchAll(/<dataValidation\b[^>]*\bsqref="([^"]+)"/g)) {
    const tokens = String(match[1]).split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      const parsed = parseRangeToken(token);
      if (!parsed) continue;
      ranges.push([parsed.startRow, parsed.endRow]);
    }
  }

  return ranges;
}

function rowIsProtected(rowNumber, protectedRanges) {
  return protectedRanges.some(([startRow, endRow]) => rowNumber >= startRow && rowNumber <= endRow);
}

function rowHasMeaningfulContent(rowXml) {
  const rowBody = String(rowXml || "");
  return /<v>[\s\S]*?<\/v>/.test(rowBody) || /<f\b/.test(rowBody) || /<is>[\s\S]*?<\/is>/.test(rowBody);
}

function clampDimensionRefValue(refValue, maxRow) {
  const fallbackRow = Math.max(1, Number(maxRow) || 1);
  const parts = String(refValue || "").split(":");
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1] || parts[0]);
  if (!start || !end) return refValue;

  const startRow = start.row;
  const endRow = Math.max(startRow, fallbackRow);
  const startRef = formatCellRef(start.col, startRow);
  const endRef = formatCellRef(end.col, endRow);
  if (startRef === endRef) return startRef;
  return `${startRef}:${endRef}`;
}

function updateWorksheetDimension(xml, maxRow) {
  return String(xml || "").replace(/(<dimension\b[^>]*\bref=")([^"]+)(")/, (_full, prefix, refValue, suffix) => {
    return `${prefix}${clampDimensionRefValue(refValue, maxRow)}${suffix}`;
  });
}

function trimTrailingEmptyRows(sheetXml) {
  const sheetDataMatch = /<sheetData>([\s\S]*?)<\/sheetData>/.exec(String(sheetXml || ""));
  if (!sheetDataMatch) {
    return {
      xml: sheetXml,
      maxRow: findWorksheetMaxRow(sheetXml),
    };
  }

  const rows = rowMatchesFromWorksheetXml(sheetDataMatch[1]);
  if (rows.length === 0) {
    return {
      xml: sheetXml,
      maxRow: 0,
    };
  }

  const protectedRanges = collectProtectedRowRanges(sheetXml);
  let keepCount = rows.length;
  while (keepCount > 0) {
    const current = rows[keepCount - 1];
    if (rowHasMeaningfulContent(current.xml)) break;
    if (rowIsProtected(current.rowNumber, protectedRanges)) break;
    keepCount -= 1;
  }

  if (keepCount === rows.length) {
    return {
      xml: sheetXml,
      maxRow: rows[rows.length - 1].rowNumber,
    };
  }

  const nextSheetData = `<sheetData>${rows.slice(0, keepCount).map((row) => row.xml).join("")}</sheetData>`;
  const trimmedXml = String(sheetXml).replace(sheetDataMatch[0], nextSheetData);
  const maxRow = keepCount > 0 ? rows[keepCount - 1].rowNumber : 0;
  return {
    xml: updateWorksheetDimension(trimmedXml, maxRow),
    maxRow,
  };
}

function setOrReplaceAttribute(tagXml, attrName, attrValue) {
  const attrPattern = new RegExp(`\\s${attrName}="[^"]*"`);
  if (attrPattern.test(tagXml)) {
    return tagXml.replace(attrPattern, ` ${attrName}="${attrValue}"`);
  }
  const insertIndex = tagXml.endsWith("/>") ? tagXml.length - 2 : tagXml.length - 1;
  return `${tagXml.slice(0, insertIndex)} ${attrName}="${attrValue}"${tagXml.slice(insertIndex)}`;
}

function normalizeWorksheetView(sheetXml, options = {}) {
  const maxRow = Math.max(1, Number(options.maxRow) || findWorksheetMaxRow(sheetXml) || 1);
  const sheetViewsMatch = /<sheetViews>([\s\S]*?)<\/sheetViews>/.exec(String(sheetXml || ""));
  if (!sheetViewsMatch) return sheetXml;

  const sheetViewMatch = /<sheetView\b[^>]*>[\s\S]*?<\/sheetView>/.exec(sheetViewsMatch[1]);
  if (!sheetViewMatch) return sheetXml;

  const originalSheetView = sheetViewMatch[0];
  const openTagMatch = /^<sheetView\b[^>]*>/.exec(originalSheetView);
  if (!openTagMatch) return sheetXml;
  const clearFrozenPane = Boolean(options.clearFrozenPane);

  let nextOpenTag = openTagMatch[0];
  const paneMatch = /<pane\b[^>]*\/>/.exec(originalSheetView);
  const paneXml = paneMatch ? paneMatch[0] : "";
  const ySplitMatch = /\bySplit="([^"]+)"/.exec(paneXml);
  const xSplitMatch = /\bxSplit="([^"]+)"/.exec(paneXml);
  const ySplit = ySplitMatch ? Number(ySplitMatch[1]) || 0 : 0;
  const xSplit = xSplitMatch ? Number(xSplitMatch[1]) || 0 : 0;
  const hasFrozenPane = !clearFrozenPane && Boolean(paneXml) && /\bstate="frozen"/.test(paneXml);

  const topLeftCol = hasFrozenPane ? numberToColumn((xSplit || 0) + 1) : "A";
  const topLeftRow = hasFrozenPane ? Math.min(Math.max(1, (ySplit || 0) + 1), maxRow) : 1;
  const topLeftCell = `${topLeftCol}${topLeftRow}`;
  nextOpenTag = setOrReplaceAttribute(nextOpenTag, "topLeftCell", topLeftCell);

  let activePane = "";
  if (hasFrozenPane) {
    if (xSplit > 0 && ySplit > 0) activePane = "bottomRight";
    else if (ySplit > 0) activePane = "bottomLeft";
    else if (xSplit > 0) activePane = "topRight";
  }

  let nextPaneXml = "";
  if (hasFrozenPane) {
    nextPaneXml = setOrReplaceAttribute(paneXml, "topLeftCell", topLeftCell);
    if (activePane) {
      nextPaneXml = setOrReplaceAttribute(nextPaneXml, "activePane", activePane);
    }
  }

  const selectionXml = hasFrozenPane
    ? `<selection pane="${activePane}" activeCell="${topLeftCell}" sqref="${topLeftCell}"/>`
    : `<selection activeCell="A1" sqref="A1"/>`;

  const remainingInner = originalSheetView
    .slice(openTagMatch[0].length, originalSheetView.length - "</sheetView>".length)
    .replace(/<pane\b[^>]*\/>/g, "")
    .replace(/<selection\b[^>]*\/>/g, "")
    .trim();

  const rebuiltInner = `${nextPaneXml}${selectionXml}${remainingInner}`;
  const rebuiltSheetView = `${nextOpenTag}${rebuiltInner}</sheetView>`;
  const rebuiltSheetViews = sheetViewsMatch[0].replace(originalSheetView, rebuiltSheetView);
  return String(sheetXml).replace(sheetViewsMatch[0], rebuiltSheetViews);
}

function insertConditionalFormattingNodes(sheetXml, nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return sheetXml;

  const insertionAnchors = [
    "</mergeCells>",
    "</phoneticPr>",
    "</customSheetViews>",
    "</dataConsolidate>",
    "</sortState>",
    "</autoFilter>",
    "</scenarios>",
    "</protectedRanges>",
    "</sheetProtection>",
    "</sheetCalcPr>",
    "</sheetData>",
  ];
  const block = nodes.join("");

  for (const anchor of insertionAnchors) {
    if (String(sheetXml).includes(anchor)) {
      return String(sheetXml).replace(anchor, `${anchor}${block}`);
    }
  }

  return String(sheetXml).replace("</worksheet>", `${block}</worksheet>`);
}

function applyWorksheetTransform(sheetXml, transform) {
  let workingXml = String(sheetXml || "");
  let maxRow = findWorksheetMaxRow(workingXml);
  const preserveMaxRow = Math.max(0, Number(transform?.preserveMaxRow) || 0);

  if (transform?.trimTrailingRows) {
    const trimmed = trimTrailingEmptyRows(workingXml);
    workingXml = trimmed.xml;
    maxRow = trimmed.maxRow;
  }

  maxRow = Math.max(maxRow, preserveMaxRow);

  let cleaned = removeConditionalFormattingNodes(workingXml);

  const cfConfig = transform?.conditionalFormatting;
  if (cfConfig?.nodes?.length) {
    const rebuiltNodes = rebuildConditionalFormattingNodes(cfConfig.nodes, {
      mode: cfConfig.mode || "clip",
      rowMap: cfConfig.rowMap,
      maxRow,
      sourceMaxRow: Number(cfConfig.sourceMaxRow) || 0,
      trailingRowPadding: Number(cfConfig.trailingRowPadding) || 0,
    });
    cleaned = insertConditionalFormattingNodes(cleaned, rebuiltNodes);
  }

  cleaned = capConditionalFormattingRefs(cleaned, maxRow);
  cleaned = capDataValidationRefs(cleaned);

  if (transform?.normalizeView) {
    const normalizeOptions =
      typeof transform.normalizeView === "object" ? transform.normalizeView : {};
    cleaned = normalizeWorksheetView(cleaned, { maxRow, ...normalizeOptions });
  }

  if (preserveMaxRow > 0) {
    cleaned = updateWorksheetDimension(cleaned, Math.max(maxRow, preserveMaxRow));
  }

  return cleaned;
}

function cleanupXmlText(xmlText, { isWorksheet = false, worksheetTransform = null } = {}) {
  let cleaned = String(xmlText);
  cleaned = cleaned.replace(/<v>NaN<\/v>/g, "<v>0</v>");
  cleaned = cleaned.replace(/\s+x14ac:dyDescent\s*=\s*"[^"]*"/g, "");
  cleaned = cleaned.replace(/\s+x14ac:knownFonts\s*=\s*"[^"]*"/g, "");
  if (isWorksheet) {
    cleaned = worksheetTransform
      ? applyWorksheetTransform(cleaned, worksheetTransform)
      : capDataValidationRefs(capConditionalFormattingRefs(cleaned));
  }
  return cleaned;
}

function applyStylesTransform(stylesXml, stylesTransform = null) {
  if (!stylesTransform?.differentialStylesNode) return String(stylesXml || "");

  const differentialStylesNode = String(stylesTransform.differentialStylesNode || "").trim();
  if (!differentialStylesNode) return String(stylesXml || "");

  let cleaned = String(stylesXml || "");
  if (/<dxfs\b[^>]*\/>|<dxfs\b[^>]*>[\s\S]*?<\/dxfs>/.test(cleaned)) {
    return cleaned.replace(/<dxfs\b[^>]*\/>|<dxfs\b[^>]*>[\s\S]*?<\/dxfs>/, differentialStylesNode);
  }

  for (const anchor of ["<tableStyles", "<colors", "<extLst", "</styleSheet>"]) {
    if (cleaned.includes(anchor)) {
      return cleaned.replace(anchor, `${differentialStylesNode}${anchor}`);
    }
  }

  return cleaned;
}

function stripExternalLinksFromEntries(entriesMap) {
  const cleaned = cloneEntries(entriesMap);

  for (const fileName of cleaned.keys()) {
    if (fileName.startsWith("xl/externalLinks/")) {
      cleaned.delete(fileName);
    }
  }

  const contentTypes = cleaned.get("[Content_Types].xml");
  if (typeof contentTypes === "string") {
    cleaned.set(
      "[Content_Types].xml",
      contentTypes.replace(/<Override PartName="\/xl\/externalLinks\/[^"]*"[^>]*\/>\s*/g, "")
    );
  }

  const workbookRelsPath = "xl/_rels/workbook.xml.rels";
  const workbookRels = cleaned.get(workbookRelsPath);
  if (typeof workbookRels === "string") {
    cleaned.set(
      workbookRelsPath,
      workbookRels.replace(/<Relationship[^>]*relationships\/externalLink[^>]*\/>\s*/g, "")
    );
  }

  return cleaned;
}

function cleanupXlsxEntries(entriesMap, options = {}) {
  const cleaned = new Map();
  const worksheetTransformByPath = new Map();
  const sheetTransforms = options.sheetTransforms || {};
  const stylesTransform = options.stylesTransform || null;
  const workbookSheetEntries = extractWorkbookSheetEntries(entriesMap);

  for (const [sheetName, transform] of Object.entries(sheetTransforms)) {
    const sheetInfo = workbookSheetEntries.get(sheetName);
    if (!sheetInfo?.path) continue;
    worksheetTransformByPath.set(sheetInfo.path, transform);
  }

  for (const [fileName, data] of entriesMap.entries()) {
    if (typeof data === "string" && /\.(xml|rels)$/i.test(fileName)) {
      if (fileName === "xl/styles.xml") {
        cleaned.set(fileName, applyStylesTransform(data, stylesTransform));
        continue;
      }
      cleaned.set(
        fileName,
        cleanupXmlText(data, {
          isWorksheet: isWorksheetEntry(fileName),
          worksheetTransform: worksheetTransformByPath.get(fileName) || null,
        })
      );
      continue;
    }
    cleaned.set(fileName, data);
  }

  return cleaned;
}

async function stripExternalLinks(inputPath, outputPath = inputPath) {
  const entries = await readXlsxEntries(inputPath);
  const stripped = stripExternalLinksFromEntries(entries);
  await writeXlsxFile(outputPath, stripped);
  return outputPath;
}

async function cleanupAndOverwriteXlsx(xlsxPath, options = {}) {
  const entries = await readXlsxEntries(xlsxPath);
  const cleaned = cleanupXlsxEntries(entries, options);
  await writeXlsxFile(xlsxPath, cleaned);
  return xlsxPath;
}

module.exports = {
  readXlsxEntries,
  writeXlsxFile,
  extractWorkbookSheetEntries,
  readWorkbookSheetEntries,
  extractConditionalFormattingNodes,
  extractDifferentialStylesNode,
  findWorksheetMaxRow,
  rebuildConditionalFormattingNodes,
  normalizeWorksheetView,
  trimTrailingEmptyRows,
  findWorksheetDeclaredMaxRow,
  stripExternalLinksFromEntries,
  cleanupXlsxEntries,
  stripExternalLinks,
  cleanupAndOverwriteXlsx,
  cleanupXmlText,
  capConditionalFormattingRefs,
};
