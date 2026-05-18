const path = require("node:path");
const { runMergeTask } = require("../services/merge/mergeService");

async function main() {
  const inputDir = path.join(__dirname, "..", "test");

  const request = {
    inputDir,
    outputDir: path.join(__dirname, "..", "output"),
    projectRoot: path.join(__dirname, ".."),
    rules: {
      templateFile: path.join(inputDir, "湖州仓26年5月13日进销存报表.xlsx"),
      overwriteIfExists: false,
      ifExistsStrategy: "timestamp",
      merge: {
        orderSheetName: "日报",
        orderColumn: "C",
        inputDir,
        outputName: "合并汇总"
      },
      sheetRules: [
        {
          enabled: true,
          sheetName: "日报",
          outputSheetName: "日报",
          headerRows: 3,
          splitColumn: "C",
          skipEmpty: false,
          removeColumnsByHeader: [],
          columnAliasMap: {}
        },
        {
          enabled: true,
          sheetName: "合格品入货记录",
          outputSheetName: "合格品入货记录",
          headerRows: 1,
          splitColumn: "C",
          skipEmpty: false,
          removeColumnsByHeader: [],
          columnAliasMap: {}
        },
        {
          enabled: true,
          sheetName: "合格品出库记录",
          outputSheetName: "合格品出库记录",
          headerRows: 1,
          splitColumn: "C",
          skipEmpty: false,
          removeColumnsByHeader: ["当前库存"],
          columnAliasMap: {}
        },
        {
          enabled: true,
          sheetName: "零跑退回",
          outputSheetName: "零跑退回",
          headerRows: 1,
          splitColumn: "C",
          skipEmpty: false,
          removeColumnsByHeader: [],
          columnAliasMap: {}
        },
        {
          enabled: true,
          sheetName: "库内不良",
          outputSheetName: "库内不良",
          headerRows: 1,
          splitColumn: "C",
          skipEmpty: false,
          removeColumnsByHeader: [],
          columnAliasMap: {}
        }
      ]
    }
  };

  const logger = {
    info(msg, ctx) { console.log(`[INFO] ${msg}`, ctx); },
    warn(msg, ctx) { console.log(`[WARN] ${msg}`, ctx); },
    error(msg, ctx) { console.log(`[ERROR] ${msg}`, ctx); }
  };
  const reportProgress = (pct, stage) => console.log(`[${pct}%] ${stage}`);

  const result = await runMergeTask(request, { logger, reportProgress });
  console.log("\n合并完成：");
  console.log(`  输出文件: ${result.outputFile}`);
  console.log(`  源文件数: ${result.sourceFileCount}`);
  console.log(`  合并行数: ${result.mergedRowCount}`);
  console.log(`  供应商数: ${result.vendorCount}`);
}

main().catch((err) => {
  console.error("合并失败：", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
