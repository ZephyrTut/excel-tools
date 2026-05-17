const ExcelJS = require("exceljs");

async function readWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath, {
    ignoreNodes: ["picture", "drawing", "extLst"]
  });
  return workbook;
}

module.exports = {
  readWorkbook
};
