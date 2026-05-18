const { AppError, ErrorCodes } = require("../split/errors");

function colLetterToNumber(letter) {
  const upper = String(letter || "").toUpperCase().trim();
  if (!/^[A-Z]+$/.test(upper)) {
    throw new AppError(
      ErrorCodes.INVALID_RULES,
      `Invalid column "${letter}". Use Excel column letters like C or AA.`
    );
  }
  return [...upper].reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0);
}

function normalizeHeaderName(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function normalizeAliasMap(mapValue) {
  const result = new Map();
  if (!mapValue || typeof mapValue !== "object") return result;
  for (const [from, to] of Object.entries(mapValue)) {
    const fromKey = normalizeHeaderName(from);
    const toKey = normalizeHeaderName(to);
    if (!fromKey || !toKey) continue;
    result.set(fromKey, toKey);
  }
  return result;
}

function normalizeSheetRules(sheetRules) {
  return (sheetRules || [])
    .filter((rule) => rule.enabled !== false)
    .map((rule) => ({
      ...rule,
      outputSheetName: rule.outputSheetName || rule.sheetName,
      headerRows: Number(rule.headerRows || 0),
      splitColumnIndex: colLetterToNumber(rule.splitColumn || "C"),
      removeHeaderSet: new Set(
        (rule.removeColumnsByHeader || []).map((name) => normalizeHeaderName(name)).filter(Boolean)
      ),
      aliasMap: normalizeAliasMap(rule.columnAliasMap)
    }));
}

function validateMergeRequest(request) {
  if (!request || !request.outputDir) {
    throw new AppError(ErrorCodes.INVALID_REQUEST, "outputDir is required.");
  }
}

module.exports = {
  colLetterToNumber,
  normalizeHeaderName,
  normalizeSheetRules,
  validateMergeRequest
};
