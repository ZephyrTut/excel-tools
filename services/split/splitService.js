const path = require("node:path");
const { validateSplitRequest, normalizeSheetRules } = require("./splitTypes");
const { readWorkbook } = require("./excelReader");
const { runSplitEngine } = require("./splitEngine");
const { loadRules } = require("./ruleManager");

async function resolveRules(request) {
  if (request.rules) return request.rules;
  return loadRules({
    projectRoot: request.projectRoot || process.cwd(),
    userDataPath: request.userDataPath
  });
}

function resolveOutputDir(request, rulesConfig) {
  if (request.outputDir) {
    return path.resolve(request.outputDir);
  }
  const base = request.projectRoot || process.cwd();
  return path.resolve(base, rulesConfig.defaultOutputDir || ".\\output");
}

async function runSplitTask(request, { logger, reportProgress }) {
  validateSplitRequest(request);
  logger.info("Split task started.", {
    inputFile: request.inputFile,
    outputDir: request.outputDir
  });

  reportProgress(5, "Loading rules");
  const rulesConfig = await resolveRules(request);

  reportProgress(8, "Reading workbook");
  const workbook = await readWorkbook(request.inputFile);
  reportProgress(9, "Workbook loaded");
  let templateWorkbook = null;
  if (rulesConfig.templateFile) {
    const templatePath = path.isAbsolute(rulesConfig.templateFile)
      ? rulesConfig.templateFile
      : path.resolve(request.projectRoot || process.cwd(), rulesConfig.templateFile);
    reportProgress(9, "Loading template workbook");
    templateWorkbook = await readWorkbook(templatePath);
  }
  let rules = normalizeSheetRules(rulesConfig.sheetRules || []);

  if (rulesConfig.preserveSheetOrder) {
    const enabledRuleMap = new Map(rules.map((rule) => [rule.sheetName, rule]));
    rules = workbook.worksheets
      .map((sheet) => enabledRuleMap.get(sheet.name))
      .filter(Boolean);
  }

  const outputOptions = {
    outputDir: resolveOutputDir(request, rulesConfig),
    overwriteIfExists: rulesConfig.overwriteIfExists,
    ifExistsStrategy: rulesConfig.ifExistsStrategy,
    fileName: rulesConfig.fileName || {}
  };

  const result = await runSplitEngine({
    workbook,
    templateWorkbook,
    rules,
    outputOptions,
    splitConfig: rulesConfig.split || {},
    logger,
    reportProgress
  });

  logger.info("Split task completed.", {
    splitKeys: result.splitKeyCount,
    files: result.outputFiles.length
  });

  return result;
}

module.exports = {
  runSplitTask
};
