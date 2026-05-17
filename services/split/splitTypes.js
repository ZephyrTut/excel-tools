const { AppError, ErrorCodes } = require("./errors");

function colLetterToNumber(letter) {
  const upper = String(letter || "").toUpperCase().trim();
  if (!/^[A-Z]+$/.test(upper)) {
    throw new AppError(
      ErrorCodes.INVALID_RULES,
      `Invalid splitColumn "${letter}". Use Excel column letters like C or AA.`
    );
  }

  return [...upper].reduce((acc, char) => acc * 26 + (char.charCodeAt(0) - 64), 0);
}

function normalizeSheetRules(sheetRules) {
  return sheetRules
    .filter((rule) => rule.enabled !== false)
    .map((rule) => ({
      ...rule,
      headerRows: Number(rule.headerRows || 0),
      splitColumnIndex: colLetterToNumber(rule.splitColumn)
    }));
}

function validateSplitRequest(request) {
  if (!request || !request.inputFile) {
    throw new AppError(ErrorCodes.INVALID_REQUEST, "inputFile is required.");
  }
  if (!request.outputDir) {
    throw new AppError(ErrorCodes.INVALID_REQUEST, "outputDir is required.");
  }
}

module.exports = {
  normalizeSheetRules,
  validateSplitRequest
};
