const path = require("node:path");
const ExcelJS = require("exceljs");
const { runSplitTask } = require("./services/split/splitService");

function cellText(cell) {
  const value = cell?.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "text")) return String(value.text || "");
    if (Object.prototype.hasOwnProperty.call(value, "result")) return String(value.result ?? "");
    if (Object.prototype.hasOwnProperty.call(value, "richText")) {
      const richText = Array.isArray(value.richText) ? value.richText : [];
      return richText.map((run) => run.text || "").join("");
    }
    if (Object.prototype.hasOwnProperty.call(value, "error")) return String(value.error || "");
  }
  return String(value);
}

function fillKey(fill) {
  return JSON.stringify(fill || null);
}

async function validateDailyAvailableStockFill(sourceFile, generatedFiles) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourceFile);

  const sourceSheet = workbook.getWorksheet("日报");
  if (!sourceSheet) {
    throw new Error("源文件中未找到“日报”sheet，无法校验可用结存底色。");
  }

  const headerRows = 3;
  const splitColumnIndex = 3;
  const availableStockColumnIndex = 13;
  const sourceRowsByKey = new Map();

  for (let rowNum = headerRows + 1; rowNum <= sourceSheet.rowCount; rowNum += 1) {
    const row = sourceSheet.getRow(rowNum);
    const key = cellText(row.getCell(splitColumnIndex)).trim();
    if (!key) continue;
    if (!sourceRowsByKey.has(key)) sourceRowsByKey.set(key, []);
    sourceRowsByKey.get(key).push(rowNum);
  }

  const mismatches = [];

  for (const generatedFile of generatedFiles) {
    const outputWorkbook = new ExcelJS.Workbook();
    await outputWorkbook.xlsx.readFile(generatedFile);
    const outputSheet = outputWorkbook.getWorksheet("日报");
    if (!outputSheet) {
      throw new Error(`生成文件中未找到“日报”sheet: ${generatedFile}`);
    }

    const outputRows = [];
    let splitKey = "";
    for (let rowNum = headerRows + 1; rowNum <= outputSheet.rowCount; rowNum += 1) {
      const row = outputSheet.getRow(rowNum);
      const key = cellText(row.getCell(splitColumnIndex)).trim();
      if (!key) continue;
      if (!splitKey) splitKey = key;
      outputRows.push({ rowNum, key });
    }

    const sourceRows = sourceRowsByKey.get(splitKey) || [];
    const compareCount = Math.min(sourceRows.length, outputRows.length);

    for (let index = 0; index < compareCount; index += 1) {
      const sourceRowNum = sourceRows[index];
      const outputRowNum = outputRows[index].rowNum;
      const sourceFill = fillKey(
        sourceSheet.getRow(sourceRowNum).getCell(availableStockColumnIndex).fill
      );
      const outputFill = fillKey(
        outputSheet.getRow(outputRowNum).getCell(availableStockColumnIndex).fill
      );
      if (sourceFill !== outputFill) {
        mismatches.push({
          file: generatedFile,
          key: splitKey,
          row: outputRowNum,
          sourceRow: sourceRowNum,
          sourceFill,
          outputFill
        });
        if (mismatches.length >= 20) break;
      }
    }

    if (mismatches.length >= 20) break;
  }

  if (mismatches.length > 0) {
    const details = mismatches
      .map((item) =>
        `${path.basename(item.file)} | key=${item.key} | outRow=${item.row} | srcRow=${item.sourceRow}`
      )
      .join("\n");
    throw new Error(`拆分后“可用结存”底色校验失败:\n${details}`);
  }
}

async function main() {
  const sourceFile = path.join(__dirname, "test", "华锐捷2.xlsx");
  const request = {
    inputFile: sourceFile,
    outputDir: path.join(__dirname, "test"),
    projectRoot: __dirname,
    rules: {
      preserveSheetOrder: true,
      overwriteIfExists: true,
      ifExistsStrategy: "timestamp",
      templateFile: path.join(
        __dirname,
        "test",
        "浙江华锐捷技术有限公司日报表(2).xlsx"
      ),
      fileName: {
        source: "splitKey",
        prefix: "",
        suffix: "日报表",
      },
      split: {
        skipEmptySplitKey: true,
        trimSplitKey: true,
      },
      sheetRules: [
        {
          enabled: true,
          sheetName: "日报",
          headerRows: 3,
          splitColumn: "C",
          splitBy: "cellValue",
          outputSheetName: "日报",
          skipEmpty: true,
        },
        {
          enabled: true,
          sheetName: "合格品入货记录",
          headerRows: 1,
          splitColumn: "C",
          splitBy: "cellValue",
          outputSheetName: "合格品入货记录",
          skipEmpty: true,
        },
        {
          enabled: true,
          sheetName: "合格品出库记录",
          headerRows: 1,
          splitColumn: "C",
          splitBy: "cellValue",
          outputSheetName: "合格品出库记录",
          skipEmpty: true,
        },
        {
          enabled: true,
          sheetName: "领跑良品退回",
          headerRows: 1,
          splitColumn: "C",
          splitBy: "cellValue",
          outputSheetName: "领跑良品退回",
          skipEmpty: true,
        },
        {
          enabled: true,
          sheetName: "不良品库存",
          headerRows: 1,
          splitColumn: "C",
          splitBy: "cellValue",
          outputSheetName: "不良品库存",
          skipEmpty: true,
        },
      ],
    },
  };

  const logger = {
    info(message, context = {}) {
      console.log(`[INFO] ${message}`, context);
    },
    warn(message, context = {}) {
      console.log(`[WARN] ${message}`, context);
    },
    error(message, context = {}) {
      console.log(`[ERROR] ${message}`, context);
    },
  };

  const reportProgress = (progress, stage) => {
    console.log(`[${progress}%] ${stage}`);
  };

  const result = await runSplitTask(request, { logger, reportProgress });
  await validateDailyAvailableStockFill(sourceFile, result.outputFiles);
  console.log("\n拆分完成：");
  result.outputFiles.forEach((file) => console.log(`- ${file}`));
}

main().catch((error) => {
  console.error("拆分失败：", error.message);
  if (error.stack) console.error(error.stack);
  process.exit(1);
});
