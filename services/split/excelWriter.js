const fs = require("node:fs/promises");
const path = require("node:path");
const {
  ensureDirectory,
  sanitizeWindowsFileName
} = require("../common/pathUtil");

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
    ifExistsStrategy = "timestamp"
  } = options;
  await ensureDirectory(outputDir);

  const outputs = [];
  for (const [key, workbook] of workbooksByKey.entries()) {
    const safeKey = sanitizeWindowsFileName(key);
    const filePath = await pickOutputPath(
      outputDir,
      safeKey,
      ifExistsStrategy,
      overwriteIfExists
    );
    await workbook.xlsx.writeFile(filePath);
    outputs.push(filePath);
    logger.info("Split file written.", { key, filePath });
  }

  return outputs;
}

module.exports = {
  writeSplitOutputs
};
