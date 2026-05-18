const fs = require("node:fs");
const path = require("node:path");
const ExcelJS = require("exceljs");

function stableStringify(value) {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function normalizeText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "text")) return String(value.text || "");
    if (Object.prototype.hasOwnProperty.call(value, "result")) return normalizeText(value.result);
    if (Object.prototype.hasOwnProperty.call(value, "richText")) {
      const rich = Array.isArray(value.richText) ? value.richText : [];
      return rich.map((run) => run.text || "").join("");
    }
  }
  return String(value);
}

function inferHeaderRows(sheet) {
  for (let rowNum = 1; rowNum <= 6; rowNum += 1) {
    let found = false;
    sheet.getRow(rowNum).eachCell({ includeEmpty: false }, (cell) => {
      if (normalizeText(cell.value).replace(/\s+/g, "") === "序号") found = true;
    });
    if (found) return rowNum;
  }
  return 1;
}

async function loadWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

function findLatestOutput(testDir) {
  const entries = fs.readdirSync(testDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /汇总.*\.xlsx$/i.test(name))
    .filter((name) => !name.startsWith("~$"))
    .map((name) => ({
      path: path.join(testDir, name),
      mtime: fs.statSync(path.join(testDir, name)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files[0]?.path || null;
}

async function main() {
  const projectRoot = path.join(__dirname, "..");
  const testDir = path.join(projectRoot, "test");
  const templateFile = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(testDir, "湖州仓26年5月13日进销存报表.xlsx");
  const outputFile = process.argv[3] ? path.resolve(process.argv[3]) : findLatestOutput(testDir);

  if (!fs.existsSync(templateFile)) {
    console.error(`❌ 模板不存在: ${templateFile}`);
    process.exit(1);
  }
  if (!outputFile || !fs.existsSync(outputFile)) {
    console.error("❌ 未找到汇总输出文件，请先运行 npm run merge:huzhou");
    process.exit(1);
  }

  const template = await loadWorkbook(templateFile);
  const output = await loadWorkbook(outputFile);
  const lines = [`模板: ${templateFile}`, `输出: ${outputFile}`, ""];
  let diffCount = 0;

  if (template.worksheets.length !== output.worksheets.length) {
    lines.push(
      `Sheet 数不一致: 模板=${template.worksheets.length} 输出=${output.worksheets.length}`
    );
    diffCount += 1;
  }

  const maxSheets = Math.max(template.worksheets.length, output.worksheets.length);
  for (let i = 0; i < maxSheets; i += 1) {
    const ts = template.worksheets[i];
    const os = output.worksheets[i];
    if (!ts || !os) {
      diffCount += 1;
      continue;
    }
    lines.push(`\n[Sheet ${i + 1}] ${ts.name}`);
    if (ts.name !== os.name) {
      lines.push(`- Sheet 名称不一致: 模板=${ts.name} 输出=${os.name}`);
      diffCount += 1;
    }

    const headerRows = inferHeaderRows(ts);
    const maxCol = Math.max(ts.columnCount || 1, os.columnCount || 1);

    for (let col = 1; col <= maxCol; col += 1) {
      const tw = ts.getColumn(col).width || null;
      const ow = os.getColumn(col).width || null;
      if (tw !== ow) {
        diffCount += 1;
        lines.push(`- 列宽差异 col=${col}: 模板=${tw ?? "default"} 输出=${ow ?? "default"}`);
      }
    }

    const normalizeHeaderMerges = (sheet) =>
      stableStringify(
        (sheet.model?.merges || []).filter((range) => {
        const rowText = String(range).split(":")[0].replace(/[A-Z]/g, "");
        const rowNum = Number(rowText || 0);
        return rowNum <= headerRows;
        })
      );
    const tMerges = normalizeHeaderMerges(ts);
    const oMerges = normalizeHeaderMerges(os);
    if (tMerges !== oMerges) {
      diffCount += 1;
      lines.push("- 表头合并区域差异");
    }

    for (let row = 1; row <= headerRows; row += 1) {
      for (let col = 1; col <= maxCol; col += 1) {
        const tc = ts.getRow(row).getCell(col);
        const oc = os.getRow(row).getCell(col);
        if (normalizeText(tc.value) !== normalizeText(oc.value)) {
          diffCount += 1;
          lines.push(`- 表头值差异 R${row}C${col}`);
        }
        const tsStyle = stableStringify({
          font: tc.font || null,
          fill: tc.fill || null,
          border: tc.border || null,
          alignment: tc.alignment || null,
          numFmt: tc.numFmt || null
        });
        const osStyle = stableStringify({
          font: oc.font || null,
          fill: oc.fill || null,
          border: oc.border || null,
          alignment: oc.alignment || null,
          numFmt: oc.numFmt || null
        });
        if (tsStyle !== osStyle) {
          diffCount += 1;
          lines.push(`- 表头样式差异 R${row}C${col}`);
        }
      }
    }
  }

  const hasNA = output.worksheets.some((sheet) => {
    for (let r = 1; r <= sheet.rowCount; r += 1) {
      const row = sheet.getRow(r);
      for (let c = 1; c <= row.cellCount; c += 1) {
        const text = normalizeText(row.getCell(c).value).trim().toUpperCase();
        if (text === "#N/A") return true;
      }
    }
    return false;
  });
  if (hasNA) {
    diffCount += 1;
    lines.push("\n检测到 #N/A，未满足归一化为 0 的要求。");
  }

  const reportPath = path.join(projectRoot, "merge-comparison-result.txt");
  fs.writeFileSync(reportPath, lines.join("\n"), "utf8");
  console.log(lines.join("\n"));
  console.log(`\n✓ 报告已写入: ${reportPath}`);
  process.exit(diffCount > 0 ? 2 : 0);
}

main().catch((error) => {
  console.error("❌ 对比失败:", error.message);
  console.error(error.stack || "");
  process.exit(1);
});
