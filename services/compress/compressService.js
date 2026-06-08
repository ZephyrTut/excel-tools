const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { optimizeOne } = require("./compressEngine");

/**
 * Recursively walk a directory for .xlsx files, excluding a given directory.
 */
async function walkDir(dir, excludeDir) {
  const results = [];
  const excludePath = excludeDir ? path.resolve(excludeDir) : null;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (excludePath && fullPath.startsWith(excludePath + path.sep)) continue;
    if (entry.isDirectory()) {
      results.push(...(await walkDir(fullPath, excludeDir)));
    } else if (entry.isFile() && /\.xlsx$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Run compress task for files or a directory.
 *
 * Input: { inputDir, outputDir? }  — folder mode, scan for .xlsx
 *   or   { inputPath }             — single file mode
 *
 * Output: { totalFiles, totalOriginalSize, totalOptimizedSize, savingsPercent, fileResults }
 */
async function runCompressTask(request, { logger, reportProgress }) {
  const isSingleFile = !!request.inputPath;

  if (isSingleFile) {
    return runSingleFile(request, { logger, reportProgress });
  }

  return runDirectoryMode(request, { logger, reportProgress });
}

async function runSingleFile(request, { logger, reportProgress }) {
  const filePath = path.resolve(request.inputPath);
  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  logger.info("Compress single file started.", { filePath });

  const dirName = path.dirname(filePath);
  const ext = path.extname(filePath);
  const baseName = path.basename(filePath, ext);
  const outputPath = path.join(dirName, `${baseName}_min${ext}`);

  reportProgress(10, `压缩: ${path.basename(filePath)}`);
  const result = await optimizeOne(filePath, outputPath);
  reportProgress(100, "压缩完成");

  logger.info("Compress single file completed.", {
    originalSize: result.originalSize,
    optimizedSize: result.optimizedSize,
    savingsPercent: result.savingsPercent,
  });

  return {
    totalFiles: 1,
    totalOriginalSize: result.originalSize,
    totalOptimizedSize: result.optimizedSize,
    savingsPercent: result.savingsPercent,
    fileResults: [result],
  };
}

async function runDirectoryMode(request, { logger, reportProgress }) {
  const { inputDir } = request;
  const outputDir = request.outputDir || inputDir;

  // Validate
  const inputStat = await fsp.stat(inputDir).catch(() => null);
  if (!inputStat || !inputStat.isDirectory()) {
    throw new Error(`Input directory does not exist: ${inputDir}`);
  }

  logger.info("Compress task started.", { inputDir, outputDir });

  // Scan for .xlsx files, excluding output directory to prevent recursive compression
  const files = await walkDir(inputDir, outputDir);
  if (files.length === 0) {
    logger.warn("No .xlsx files found.", { inputDir });
    return {
      totalFiles: 0,
      totalOriginalSize: 0,
      totalOptimizedSize: 0,
      savingsPercent: "0.0",
      fileResults: [],
    };
  }

  logger.info("Files found.", { count: files.length });
  reportProgress(1, `找到 ${files.length} 个文件`);

  // Process each file
  const fileResults = [];
  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = path.relative(inputDir, filePath);
    const relName = relPath.replace(/\.xlsx$/i, "_min.xlsx");
    const outputPath = path.join(outputDir, relName);

    const pct = Math.round(((i + 1) / files.length) * 98) + 1;
    reportProgress(pct, `压缩: ${relPath} (${i + 1}/${files.length})`);
    logger.info("Compressing file.", {
      file: relPath,
      index: i + 1,
      total: files.length,
    });

    const result = await optimizeOne(filePath, outputPath);
    totalOriginalSize += result.originalSize;
    totalOptimizedSize += result.optimizedSize;
    fileResults.push(result);
  }

  reportProgress(100, "压缩完成");
  const savingsPercent =
    totalOriginalSize > 0
      ? (
          ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) *
          100
        ).toFixed(1)
      : "0.0";

  logger.info("Compress task completed.", {
    totalFiles: files.length,
    totalOriginalSize,
    totalOptimizedSize,
    savingsPercent,
  });

  return {
    totalFiles: files.length,
    totalOriginalSize,
    totalOptimizedSize,
    savingsPercent,
    fileResults,
  };
}

module.exports = { runCompressTask, walkDir };
