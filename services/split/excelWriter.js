const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ensureDirectory,
  sanitizeWindowsFileName
} = require("./pathUtil");

async function pickOutputPath(outputDir, baseName, strategy, overwriteIfExists) {
  const defaultPath = path.join(outputDir, `${baseName}.xlsx`);
  if (overwriteIfExists) return defaultPath;

  try {
    await fs.access(defaultPath);
    if (strategy === "timestamp") {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      return path.join(outputDir, `${baseName}_${ts}.xlsx`);
    }
    return defaultPath;
  } catch {
    return defaultPath;
  }
}

async function writeSplitOutputs(workbooksByKey, options, logger) {
  const {
    outputDir,
    overwriteIfExists = false,
    ifExistsStrategy = "timestamp",
    fileName = {}
  } = options;
  await ensureDirectory(outputDir);

  const outputs = [];
  for (const [key, workbook] of workbooksByKey.entries()) {
    const filePath = await writeSplitOutput(key, workbook, options, logger);
    outputs.push(filePath);
  }

  return outputs;
}

async function writeSplitOutput(splitKey, workbook, options, logger) {
  const {
    outputDir,
    overwriteIfExists = false,
    ifExistsStrategy = "timestamp",
    fileName = {}
  } = options;
  await ensureDirectory(outputDir);
  const baseName = buildFileBaseName(splitKey, fileName);
  const safeKey = sanitizeWindowsFileName(baseName);
  const filePath = await pickOutputPath(
    outputDir,
    safeKey,
    ifExistsStrategy,
    overwriteIfExists
  );
  await workbook.xlsx.writeFile(filePath);
  logger.info("Split file written.", { key: splitKey, filePath });
  return filePath;
}

function buildFileBaseName(splitKey, fileNameOptions) {
  const prefix = String(fileNameOptions.prefix || "");
  const suffix = String(fileNameOptions.suffix || "");
  const source = fileNameOptions.source || "splitKey";
  const customName = String(fileNameOptions.customName || "");
  const core = source === "customName" ? customName : splitKey;
  const merged = `${prefix}${core}${suffix}`.trim();
  return merged || "unknown";
}

module.exports = {
  writeSplitOutputs,
  writeSplitOutput
};
