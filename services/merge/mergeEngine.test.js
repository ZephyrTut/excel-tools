const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");

const {
  mapSourceToTargetColumns,
  resolveTemplateStyleRow,
  trimTrailingVendorlessRows,
} = require("./mergeEngine");

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

test("trimTrailingVendorlessRows removes trailing daily rows when vendor is blank", () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("日报");

  sheet.getCell("A1").value = "序号";
  sheet.getCell("C1").value = "供应商名称";
  sheet.getCell("Q1").value = "可用结存";

  sheet.getCell("A2").value = 1;
  sheet.getCell("C2").value = "供应商A";
  sheet.getCell("K2").value = 20;
  sheet.getCell("Q2").value = 5;

  sheet.getCell("A3").value = 2;
  sheet.getCell("C3").value = null;
  sheet.getCell("I3").value = 0;
  sheet.getCell("J3").value = 0;
  sheet.getCell("K3").value = 0;
  sheet.getCell("Q3").value = 0;

  sheet.getCell("A4").value = 3;
  sheet.getCell("C4").value = null;
  sheet.getCell("I4").value = 0;
  sheet.getCell("J4").value = 0;
  sheet.getCell("K4").value = 0;
  sheet.getCell("Q4").value = 1;

  const removed = trimTrailingVendorlessRows(sheet, {
    headerRows: 1,
    splitColumnIndex: 3,
    sequenceColumnIndex: 1,
    dataColumnCount: 17,
  });

  assert.equal(removed, 2);
  assert.equal(sheet.rowCount, 2);
  assert.equal(sheet.getCell("C2").value, "供应商A");
});

test("trimTrailingVendorlessRows keeps trailing rows when vendor is present", () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("日报");

  sheet.getCell("A1").value = "序号";
  sheet.getCell("C1").value = "供应商名称";

  sheet.getCell("A2").value = 1;
  sheet.getCell("C2").value = "供应商B";
  sheet.getCell("K2").value = 10;

  const removed = trimTrailingVendorlessRows(sheet, {
    headerRows: 1,
    splitColumnIndex: 3,
    sequenceColumnIndex: 1,
    dataColumnCount: 11,
  });

  assert.equal(removed, 0);
  assert.equal(sheet.rowCount, 2);
});

test("resolveTemplateStyleRow prefers the matching template row before falling back to the first data row", () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("日报");

  sheet.getCell("K4").fill = {
    type: "pattern",
    pattern: "none",
  };
  sheet.getCell("K10").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFFFFF" },
    bgColor: { indexed: 64 },
  };

  const matchedRow = resolveTemplateStyleRow(sheet, 3, 10);
  const fallbackRow = resolveTemplateStyleRow(sheet, 3, 999);

  assert.equal(matchedRow.number, 10);
  assert.equal(matchedRow.getCell("K").fill.pattern, "solid");
  assert.equal(fallbackRow.number, 4);
  assert.equal(fallbackRow.getCell("K").fill.pattern, "none");
});
