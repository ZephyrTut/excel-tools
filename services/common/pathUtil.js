const fs = require("node:fs/promises");
const path = require("node:path");

const WINDOWS_INVALID_FILE_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;

function sanitizeWindowsFileName(input, fallback = "unknown") {
  const normalized = String(input ?? "")
    .replace(WINDOWS_INVALID_FILE_CHARS, "_")
    .trim()
    .replace(/\s+/g, " ");
  if (!normalized) return fallback;
  return normalized.slice(0, 120);
}

async function ensureDirectory(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function resolveOutputFilePath({
  outputDir,
  baseName,
  extension = ".xlsx",
  overwriteIfExists,
  ifExistsStrategy
}) {
  const fileName = `${baseName}${extension}`;
  const fullPath = path.join(outputDir, fileName);
  if (overwriteIfExists) return fullPath;

  if (ifExistsStrategy === "timestamp") {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(outputDir, `${baseName}_${ts}${extension}`);
  }

  return fullPath;
}

module.exports = {
  sanitizeWindowsFileName,
  ensureDirectory,
  resolveOutputFilePath
};
