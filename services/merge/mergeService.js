const fs = require("node:fs/promises");
const path = require("node:path");
const { AppError, ErrorCodes } = require("../split/errors");
const { readWorkbook } = require("../split/excelReader");
const { loadRules } = require("../split/ruleManager");
const { ensureDirectory, sanitizeWindowsFileName } = require("../split/pathUtil");
const { runMergeEngine } = require("./mergeEngine");
const { colLetterToNumber, normalizeSheetRules, validateMergeRequest } = require("./mergeTypes");

async function resolveRules(request) {
  if (request.rules) return request.rules;
  return loadRules({
    projectRoot: request.projectRoot || process.cwd(),
    userDataPath: request.userDataPath
  });
}

function resolveTemplatePath(request, rulesConfig) {
  const templateFile = rulesConfig.templateFile;
  if (!templateFile) {
    throw new AppError(ErrorCodes.INVALID_RULES, "templateFile is required for merge.");
  }
  return path.isAbsolute(templateFile)
    ? templateFile
    : path.resolve(request.projectRoot || process.cwd(), templateFile);
}

function resolveMergeInputDir(request, rulesConfig) {
  if (request.inputDir) return path.resolve(request.inputDir);
  const configured = rulesConfig?.merge?.inputDir || ".\\test";
  return path.resolve(request.projectRoot || process.cwd(), configured);
}

function resolveMergeOutputPath(outputDir, rulesConfig) {
  const fileName = sanitizeWindowsFileName(rulesConfig?.merge?.outputName || "合并汇总", "合并汇总");
  const extName = fileName.toLowerCase().endsWith(".xlsx") ? "" : ".xlsx";
  return path.join(outputDir, `${fileName}${extName}`);
}

async function listSourceFiles(inputDir, excludedAbsolutePaths) {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  const excluded = new Set(excludedAbsolutePaths.map((item) => path.resolve(item)));
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(inputDir, entry.name))
    .filter((filePath) => filePath.toLowerCase().endsWith(".xlsx"))
    .filter((filePath) => !path.basename(filePath).startsWith("~$"))
    .filter((filePath) => !excluded.has(path.resolve(filePath)));
}

async function writeMergeOutput(workbook, outputPath, overwriteIfExists) {
  await ensureDirectory(path.dirname(outputPath));
  if (!overwriteIfExists) {
    try {
      await fs.access(outputPath);
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const ext = path.extname(outputPath);
      const base = outputPath.slice(0, -ext.length);
      outputPath = `${base}_${ts}${ext}`;
    } catch {
      // no existing file
    }
  }
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

async function runMergeTask(request, { logger, reportProgress }) {
  validateMergeRequest(request);
  reportProgress(5, "Loading rules");
  const rulesConfig = await resolveRules(request);
  const mergeConfig = rulesConfig.merge || {};
  const templatePath = resolveTemplatePath(request, rulesConfig);
  const outputDir = path.resolve(request.outputDir);
  const inputDir = resolveMergeInputDir(request, rulesConfig);

  logger.info("Merge task started.", {
    templatePath,
    inputDir,
    outputDir
  });

  reportProgress(10, "Loading template workbook");
  const templateWorkbook = await readWorkbook(templatePath);
  const rules = normalizeSheetRules(rulesConfig.sheetRules || []);
  if (rules.length === 0) {
    throw new AppError(ErrorCodes.INVALID_RULES, "No enabled sheetRules found for merge.");
  }

  const outputPath = resolveMergeOutputPath(outputDir, rulesConfig);
  const sourceFiles = await listSourceFiles(inputDir, [templatePath, outputPath]);
  if (sourceFiles.length === 0) {
    throw new AppError(
      ErrorCodes.INVALID_REQUEST,
      `No source xlsx files found in ${inputDir} (template/output excluded).`
    );
  }
  logger.info("Merge source files resolved.", { count: sourceFiles.length });

  const result = await runMergeEngine({
    sourceFiles,
    templateWorkbook,
    rules,
    mergeConfig: {
      ...mergeConfig,
      orderColumnIndex: mergeConfig.orderColumn
        ? colLetterToNumber(mergeConfig.orderColumn)
        : undefined
    },
    logger,
    reportProgress
  });

  reportProgress(95, "Writing merged workbook");
  const outputFile = await writeMergeOutput(
    result.workbook,
    outputPath,
    Boolean(rulesConfig.overwriteIfExists)
  );
  reportProgress(100, "Completed");

  logger.info("Merge task completed.", {
    outputFile,
    ...result.stats
  });

  return {
    outputFile,
    sourceFiles,
    ...result.stats
  };
}

module.exports = {
  runMergeTask
};
