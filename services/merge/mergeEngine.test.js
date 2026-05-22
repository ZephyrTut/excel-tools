const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");

const { mapSourceToTargetColumns } = require("./mergeEngine");

test("mapSourceToTargetColumns preserves duplicate header occurrences for daily report date blocks", () => {
  const sourceBook = new ExcelJS.Workbook();
  const targetBook = new ExcelJS.Workbook();
  const sourceSheet = sourceBook.addWorksheet("日报");
  const targetSheet = targetBook.addWorksheet("日报");

  sourceSheet.getRow(2).getCell(20).value = "入库";
  sourceSheet.getRow(2).getCell(51).value = "出库";
  targetSheet.getRow(2).getCell(20).value = "入库";
  targetSheet.getRow(2).getCell(51).value = "出库";

  sourceSheet.getRow(3).getCell(20).value = new Date("2026-05-01");
  sourceSheet.getRow(3).getCell(21).value = new Date("2026-05-02");
  sourceSheet.getRow(3).getCell(51).value = new Date("2026-05-01");
  sourceSheet.getRow(3).getCell(52).value = new Date("2026-05-02");

  targetSheet.getRow(3).getCell(20).value = new Date("2026-05-01");
  targetSheet.getRow(3).getCell(21).value = new Date("2026-05-02");
  targetSheet.getRow(3).getCell(51).value = new Date("2026-05-01");
  targetSheet.getRow(3).getCell(52).value = new Date("2026-05-02");

  const colMap = mapSourceToTargetColumns(
    {
      headerRows: 3,
      removeHeaderSet: new Set(),
      aliasMap: new Map(),
    },
    sourceSheet,
    targetSheet
  );

  assert.equal(colMap.get(20), 20);
  assert.equal(colMap.get(21), 21);
  assert.equal(colMap.get(51), 51);
  assert.equal(colMap.get(52), 52);
});
