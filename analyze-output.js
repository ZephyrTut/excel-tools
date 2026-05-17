const path = require('path');
const ExcelJS = require('exceljs');

async function analyze() {
  const dir = __dirname;
  // Read source
  const srcWB = new ExcelJS.Workbook();
  await srcWB.xlsx.readFile(path.join(dir, 'test/浙江华锐捷技术有限公司日报表.xlsx'));
  const srcSheet = srcWB.getWorksheet('不良品库存');
  
  console.log('=== SOURCE: 不良品库存 ===');
  console.log('Rows:', srcSheet.rowCount, 'Cols:', srcSheet.columnCount);
  // Header
  const hdr = srcSheet.getRow(1);
  const hdrVals = [];
  hdr.eachCell({ includeEmpty: true }, (c, i) => hdrVals.push(`[${i}]${c.value||''}`));
  console.log('Header:', hdrVals.join(', '));
  
  // Data rows style summary
  console.log('\nData row styles (row 2, 5, 10):');
  for (const rn of [2, 5, 10]) {
    const row = srcSheet.getRow(rn);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      console.log(`  [${col}] val=${cell.value} fmt=${cell.numFmt} font=${cell.font?.name||'-'}/${cell.font?.size||'-'} align=${cell.alignment?.horizontal||'-'}/${cell.alignment?.vertical||'-'} fill=${JSON.stringify(cell.fill?.fgColor||'none')} border=${cell.border?.top?.style||'-'}`);
    });
  }
  
  // Find the output file (most recent by name - timestamped files sort last)
  const fs = require('fs');
  const outDir = path.join(dir, 'temp-output');
  const outFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.xlsx'));
  // Sort to get timestamped files last (newest)
  outFiles.sort();
  const outFile = path.join(outDir, outFiles[outFiles.length - 1]);
  console.log('Reading output:', outFile);
  const outWB = new ExcelJS.Workbook();
  await outWB.xlsx.readFile(outFile);
  const outSheet = outWB.getWorksheet('不良品库存');
  
  console.log('\n=== OUTPUT: 不良品库存 ===');
  if (!outSheet) {
    console.log('ERROR: 不良品库存 sheet not found in output!');
    console.log('Available sheets:', outWB._worksheets.map(w => w.name));
    return;
  }
  console.log('Rows:', outSheet.rowCount, 'Cols:', outSheet.columnCount);
  const ohdr = outSheet.getRow(1);
  const ohdrVals = [];
  ohdr.eachCell({ includeEmpty: true }, (c, i) => ohdrVals.push(`[${i}]${c.value||''}`));
  console.log('Header:', ohdrVals.join(', '));
  
  console.log('\nOutput data row styles (row 2, 5, 10):');
  for (const rn of [2, 5, 10]) {
    if (rn > outSheet.rowCount) break;
    const row = outSheet.getRow(rn);
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      console.log(`  [${col}] val=${cell.value} fmt=${cell.numFmt} font=${cell.font?.name||'-'}/${cell.font?.size||'-'} align=${cell.alignment?.horizontal||'-'}/${cell.alignment?.vertical||'-'} fill=${JSON.stringify(cell.fill?.fgColor||'none')} border=${cell.border?.top?.style||'-'}`);
    });
  }

  // Compare values
  console.log('\n=== COMPARISON (value differences) ===');
  const maxRows = Math.min(srcSheet.rowCount, outSheet.rowCount);
  const maxCols = Math.min(srcSheet.columnCount, outSheet.columnCount);
  let diffs = 0;
  for (let r = 1; r <= maxRows; r++) {
    for (let c = 1; c <= maxCols; c++) {
      const sv = srcSheet.getRow(r).getCell(c).value;
      const ov = outSheet.getRow(r).getCell(c).value;
      if (sv === null || sv === undefined) {
        if (ov === null || ov === undefined) continue;
      }
      if (String(sv) !== String(ov)) {
        if (diffs < 20) {
          console.log(`  Diff [${r},${c}]: source="${sv}" vs output="${ov}"`);
        }
        diffs++;
      }
    }
  }
  console.log(`Total value diffs: ${diffs}`);

  // Check column widths
  console.log('\nColumn widths:');
  if (outSheet.columns) {
    outSheet.columns.forEach((col, i) => {
      console.log(`  Col ${i+1}: width=${col.width}`);
    });
  }
}

  console.log('\n=== COLUMN COUNT CHECK ===');
  const dir2 = __dirname;
  const srcWB2 = new ExcelJS.Workbook();
  await srcWB2.xlsx.readFile(path.join(dir2, 'test/华锐捷2.xlsx'));
  const srcSheet2 = srcWB2.getWorksheet('不良品库存');
  console.log('Source 不良品库存 columnCount:', srcSheet2.columnCount);
  // Get actual non-empty column range
  let maxNonEmptyCol = 0;
  for (let r = 1; r <= srcSheet2.rowCount; r++) {
    const row = srcSheet2.getRow(r);
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col > maxNonEmptyCol) maxNonEmptyCol = col;
    });
  }
  console.log('Source 不良品库存 actual max non-empty col:', maxNonEmptyCol);
  
  const outSheet2 = outWB.getWorksheet('不良品库存');
  if (outSheet2) {
    console.log('Output 不良品库存 columnCount:', outSheet2.columnCount);
    let outMaxNonEmptyCol = 0;
    for (let r = 1; r <= outSheet2.rowCount; r++) {
      const row = outSheet2.getRow(r);
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        if (col > outMaxNonEmptyCol) outMaxNonEmptyCol = col;
      });
    }
    console.log('Output 不良品库存 actual max non-empty col:', outMaxNonEmptyCol);
  }
}

analyze().catch(err => { console.error(err); process.exit(1); });
