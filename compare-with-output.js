const fs = require("node:fs");
const path = require("node:path");
const { compareWorkbooks } = require("./excel-compare-core");

const OUTPUT_FILE = path.join(__dirname, "comparison-result.txt");

function findLatestMatchingFile(directories, matchers) {
  const candidates = [];
  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const name = entry.name;
      if (!name.toLowerCase().endsWith(".xlsx")) continue;
      if (name.startsWith("~$")) continue;
      if (!matchers.every((matcher) => matcher.test(name))) continue;
      const fullPath = path.join(dir, name);
      candidates.push({ fullPath, mtime: fs.statSync(fullPath).mtimeMs });
    }
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0]?.fullPath || null;
}

async function main() {
  const generatedArg = process.argv[2];
  const referenceArg = process.argv[3];

  const generatedDefault = path.join(
    __dirname,
    "output",
    "浙江华锐捷技术有限公司日报表.xlsx"
  );
  const generatedFile = generatedArg
    ? path.resolve(generatedArg)
    : fs.existsSync(generatedDefault)
    ? generatedDefault
    : findLatestMatchingFile(
        [path.join(__dirname, "output"), path.join(__dirname, "test")],
        [/浙江华锐捷技术有限公司/, /日报表/, /\.xlsx$/i]
      );
  const referenceFile = referenceArg
    ? path.resolve(referenceArg)
    : path.join(__dirname, "test", "浙江华锐捷技术有限公司日报表(2).xlsx");

  if (!generatedFile || !fs.existsSync(generatedFile)) {
    console.error("❌ 未找到生成文件。");
    process.exit(1);
  }
  if (!fs.existsSync(referenceFile)) {
    console.error(`❌ 未找到模板文件: ${referenceFile}`);
    process.exit(1);
  }

  const { lines, totals } = await compareWorkbooks(generatedFile, referenceFile);
  const text = lines.join("\n");
  fs.writeFileSync(OUTPUT_FILE, text, "utf8");
  console.log(text);
  console.log(`\n✓ 比较结果已写入: ${OUTPUT_FILE}`);
  const hasDiff =
    totals.sheetNameDiffs ||
    totals.valueDiffs ||
    totals.headerStyleDiffs ||
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
