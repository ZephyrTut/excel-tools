const path = require('path');
const { runSplitTask } = require('./services/split/splitService');

const request = {
  inputFile: path.resolve(__dirname, 'test/华锐捷2.xlsx'),
  outputDir: path.resolve(__dirname, 'temp-output'),
  overwriteIfExists: true,
  rules: {
    templateFile: '',
    fileName: {
      source: 'splitKey',
      prefix: '',
      suffix: '日报表',
      sanitizeWindowsName: true,
      maxLength: 120
    },
    sheetRules: [
      {
        enabled: true,
        sheetName: '日报',
        headerRows: 3,
        splitColumn: 'C',
        splitBy: 'cellValue',
        outputSheetName: '日报',
        skipEmpty: true
      },
      {
        enabled: true,
        sheetName: '不良品库存',
        headerRows: 1,
        splitColumn: 'C',
        splitBy: 'cellValue',
        outputSheetName: '不良品库存',
        skipEmpty: true
      }
    ]
  }
};

const logger = {
  info(m, c) { console.log('[INFO]', m, c || ''); },
  warn(m, c) { console.log('[WARN]', m, c || ''); },
  error(m, c) { console.log('[ERROR]', m, c || ''); },
};

const reportProgress = (p, s) => console.log(`[${p}%] ${s}`);

runSplitTask(request, { logger, reportProgress })
  .then(result => {
    console.log('Output files:', result.outputFiles);
  })
  .catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
