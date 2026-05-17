#!/usr/bin/env node

const path = require("node:path");
const fs = require("node:fs");
const { compareWorkbooks } = require("./excel-compare-core");

async function main() {
  const generatedFile = process.argv[2];
  const referenceFile = process.argv[3];
  const outputFile = process.argv[4] || path.join(__dirname, "comparison-result.txt");

  if (!generatedFile || !referenceFile) {
    console.error(
      "用法: node compare-excel.js <生成文件.xlsx> <模板文件.xlsx> [输出报告路径.txt]"
    );
    process.exit(1);
  }
  const g = path.resolve(generatedFile);
  const r = path.resolve(referenceFile);
  if (!fs.existsSync(g)) {
    console.error(`❌ 生成文件不存在: ${g}`);
    process.exit(1);
  }
  if (!fs.existsSync(r)) {
    console.error(`❌ 模板文件不存在: ${r}`);
    process.exit(1);
  }

  const { lines, totals } = await compareWorkbooks(g, r);
  const text = lines.join("\n");
  fs.writeFileSync(path.resolve(outputFile), text, "utf8");
  console.log(text);
  console.log(`\n✓ 比较结果已写入: ${path.resolve(outputFile)}`);

  const hasDiff =
    totals.sheetNameDiffs ||
    totals.valueDiffs ||
    totals.headerStyleDiffs ||
    totals.dataFillDiffs ||
    totals.columnWidthDiffs ||
    totals.rowHeightDiffs ||
    totals.mergeDiffs;
  process.exit(hasDiff ? 2 : 0);
}

main().catch((error) => {
  console.error("❌ 对比失败:", error.message);
  console.error(error.stack || "");
  process.exit(1);
});
