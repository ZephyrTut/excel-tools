const path = require('path');
const ExcelJS = require('exceljs');
const { runSplitEngine } = require('./../services/split/splitEngine');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.resolve(__dirname, '../test/浙江华锐捷技术有限公司日报表.xlsx'));
  
  const rules = [
    {
      enabled: true,
      sheetName: '不良品库存',
      headerRows: 1,
      splitColumnIndex: 3,
      splitBy: 'cellValue',
      outputSheetName: '不良品库存',
      skipEmpty: true,
      sourceSheet: wb.getWorksheet('不良品库存'),
      templateSheet: null,
      headerSheet: wb.getWorksheet('不良品库存'),
      sequenceColumnIndex: -1,
      zeroFillColumnIndexes: new Set(),
      preserveSourceFillColumnIndexes: new Set(),
      singleRowMergesBySourceRow: new Map(),
    }
  ];
  
  const result = await runSplitEngine({
    workbook: wb,
    templateWorkbook: null,
    rules,
    outputOptions: {
      outputDir: path.resolve(__dirname, '../temp-output'),
      overwriteIfExists: true,
      fileName: { source: 'splitKey', prefix: '', suffix: '日报表', sanitizeWindowsName: true, maxLength: 120 }
    },
    splitConfig: {},
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    reportProgress: () => {}
  });
  
  console.log('Output:', result.outputFiles);
}

main().catch(e => { console.error(e); process.exit(1); });
