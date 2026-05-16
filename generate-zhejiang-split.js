const path = require("node:path");
const { runSplitTask } = require("./services/split/splitService");

async function main() {
  const request = {
    inputFile: path.join(__dirname, "test", "华锐捷2.xlsx"),
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
  console.log("\n拆分完成：");
  result.outputFiles.forEach((file) => console.log(`- ${file}`));
}

main().catch((error) => {
  console.error("拆分失败：", error.message);
  if (error.stack) console.error(error.stack);
  process.exit(1);
});
