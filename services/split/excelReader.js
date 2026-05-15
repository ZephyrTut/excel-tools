const ExcelJS = require('exceljs');

async function readWorkbook(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  return workbook;
}

module.exports = { readWorkbook };
