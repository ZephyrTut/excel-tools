const { Worker } = require('worker_threads');
const path = require('path');

const workerScript = `
const exceljs = require('exceljs');
const fs = require('fs');
const path = require('path');

// All the comparison logic inline
const generatedFile = path.join('${__dirname}', 'test', '东莞市硅翔绝缘材料有限公司.xlsx');
const referenceFile = path.join('${__dirname}', 'test', '东莞市硅翔绝缘材料有限公司进销存日报表5月12日.xlsx');

console.log('Command executed: node compare.js');
console.log('Working directory: ${__dirname}');
console.log('Generated file: ' + generatedFile);
console.log('Reference file: ' + referenceFile);

// Import and run compare
require('./compare.js');
`;

const worker = new Worker(workerScript, { eval: true, env: process.env, cwd: __dirname });

worker.on('message', (msg) => {
  console.log(msg);
});

worker.on('error', reject);
worker.on('exit', (code) => {
  if (code !== 0) {
    console.error(\`Worker stopped with exit code \${code}\`);
  }
});
