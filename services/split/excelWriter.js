const fs = require('fs/promises');

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeWorkbook(workbook, outputPath) {
  await workbook.xlsx.writeFile(outputPath);
}

module.exports = { ensureDir, writeWorkbook };
