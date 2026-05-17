const ExcelJS = require("exceljs");

async function readWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath, {
    ignoreNodes: ["picture", "drawing", "extLst"]
  });
  return workbook;
}

async function getSheetNames(filePath) {
  const workbook = await readWorkbook(filePath);
  return workbook.worksheets
    .filter((ws) => ws.state === "visible")
    .map((ws) => ws.name);
}

module.exports = {
  readWorkbook,
  getSheetNames
};
