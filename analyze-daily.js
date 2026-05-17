const path = require('path');
const ExcelJS = require('exceljs');

async function analyzeDaily() {
  const dir = __dirname;
  
  // Source
  const srcWB = new ExcelJS.Workbook();
  await srcWB.xlsx.readFile(path.join(dir, 'test/浙江华锐捷技术有限公司日报表.xlsx'));
  const srcSheet = srcWB.getWorksheet('日报');
  
  console.log('=== SOURCE 日报 ===');
  console.log('Rows:', srcSheet.rowCount, 'Cols:', srcSheet.columnCount);
  console.log('Conditional formattings:');
  if (srcSheet.conditionalFormattings) {
    srcSheet.conditionalFormattings.forEach((cf, i) => {
      console.log(`  [${i}] ranges:`, cf.ranges || cf);
    });
  }
  
  // Check data for 不合格品库存 (col 12) and 可用结存 (col 13)
  console.log('\nSample data rows (cols 12,13):');
  for (const rn of [2, 3, 4, 5, 10, 15]) {
    const c12 = srcSheet.getRow(rn).getCell(12);
    const c13 = srcSheet.getRow(rn).getCell(13);
    console.log(`  Row ${rn}: L12=${c12.value} (fill=${JSON.stringify(c12.fill?.fgColor||'none')}), M13=${c13.value} (fill=${JSON.stringify(c13.fill?.fgColor||'none')})`);
  }
  
  // Output
  const fs = require('fs');
  const outDir = path.join(dir, 'temp-output');
  const outFiles = fs.readdirSync(outDir).filter(f => f.endsWith('.xlsx'));
  outFiles.sort();
  const outFile = path.join(outDir, outFiles[outFiles.length - 1]);
  
  console.log('\nReading output:', outFile);
  const outWB = new ExcelJS.Workbook();
  await outWB.xlsx.readFile(outFile);
  const outSheet = outWB.getWorksheet('日报');
  
  console.log('\n=== OUTPUT 日报 ===');
  console.log('Rows:', outSheet.rowCount, 'Cols:', outSheet.columnCount);
  console.log('Conditional formattings:');
  if (outSheet.conditionalFormattings) {
    outSheet.conditionalFormattings.forEach((cf, i) => {
      console.log(`  [${i}] ranges:`, cf.ranges || cf);
    });
  }
  
  console.log('\nSample data rows (cols 12,13):');
  for (const rn of [2, 3, 4, 5, 10, 15]) {
    if (rn > outSheet.rowCount) break;
    const c12 = outSheet.getRow(rn).getCell(12);
    const c13 = outSheet.getRow(rn).getCell(13);
    console.log(`  Row ${rn}: L12=${c12.value} (fill=${JSON.stringify(c12.fill?.fgColor||'none')}), M13=${c13.value} (fill=${JSON.stringify(c13.fill?.fgColor||'none')})`);
  }
  
  // Compare ALL cells in 日报 sheet
  console.log('\n=== DIFFS ===');
  const maxRows = Math.min(srcSheet.rowCount, outSheet.rowCount);
  const maxCols = Math.min(srcSheet.columnCount || 0, outSheet.columnCount || 0);
  let diffs = 0;
  let styleDiffs = 0;
  for (let r = 1; r <= maxRows; r++) {
    for (let c = 1; c <= maxCols; c++) {
      const sc = srcSheet.getRow(r).getCell(c);
      const oc = outSheet.getRow(r).getCell(c);
      
      // Value diff
      const sv = sc.value === null || sc.value === undefined ? '' : String(sc.value);
      const ov = oc.value === null || oc.value === undefined ? '' : String(oc.value);
      if (sv !== ov) {
        if (diffs < 10) console.log(`  Value [${r},${c}]: "${sv}" vs "${ov}"`);
        diffs++;
      }
      
      // Style diff (fill)
      const sf = JSON.stringify(sc.fill || null);
      const of = JSON.stringify(oc.fill || null);
      if (sf !== of) {
        if (styleDiffs < 10) console.log(`  Fill [${r},${c}]: ${sf} vs ${of}`);
        styleDiffs++;
      }
    }
  }
  console.log(`Total value diffs: ${diffs}, fill diffs: ${styleDiffs}`);
}

analyzeDaily().catch(err => { console.error(err); process.exit(1); });
