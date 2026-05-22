const path = require("node:path");
const fs = require("node:fs/promises");
const os = require("node:os");
const { validateSplitRequest, normalizeSheetRules } = require("./splitTypes");
const { readWorkbook } = require("./excelReader");
const { runSplitEngine } = require("./splitEngine");
const { loadRules } = require("./ruleManager");
const {
  readWorkbookSheetEntries,
  readXlsxEntries,
  extractDifferentialStylesNode,
  stripExternalLinks,
} = require("../optimize/zipUtils");

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

function buildTempXlsxPath(prefix) {
  return path.join(
    os.tmpdir(),
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.xlsx`
  );
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
  const sourceSheetXmlMap = await readWorkbookSheetEntries(request.inputFile).catch(() => new Map());
  const sourceEntries = await readXlsxEntries(request.inputFile).catch(() => new Map());
  const sourceDifferentialStylesNode = extractDifferentialStylesNode(sourceEntries.get("xl/styles.xml"));
  reportProgress(9, "Workbook loaded");
  let templateWorkbook = null;
  let templateSheetXmlMap = new Map();
  let tempTemplatePath = null;
  try {
    if (rulesConfig.templateFile) {
      const templatePath = path.isAbsolute(rulesConfig.templateFile)
        ? rulesConfig.templateFile
        : path.resolve(request.projectRoot || process.cwd(), rulesConfig.templateFile);
      templateSheetXmlMap = await readWorkbookSheetEntries(templatePath).catch(() => new Map());
      reportProgress(9, "Loading template workbook");
      try {
        tempTemplatePath = buildTempXlsxPath("split_template");
        await stripExternalLinks(templatePath, tempTemplatePath);
        templateWorkbook = await readWorkbook(tempTemplatePath);
      } catch (error) {
        logger.warn("Template cleanup failed, using original template.", { error: error.message });
        templateWorkbook = await readWorkbook(templatePath);
      }
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
      sourceSheetXmlMap,
      templateSheetXmlMap,
      sourceDifferentialStylesNode,
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
  } finally {
    if (tempTemplatePath) {
      fs.unlink(tempTemplatePath).catch(() => {});
    }
  }
}

module.exports = {
  runSplitTask
};
