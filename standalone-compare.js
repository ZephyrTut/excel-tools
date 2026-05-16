const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Main execution wrapper that captures and outputs everything
(async () => {
  const generatedFile = path.join(__dirname, 'test', '东莞市硅翔绝缘材料有限公司.xlsx');
  const referenceFile = path.join(__dirname, 'test', '东莞市硅翔绝缘材料有限公司进销存日报表5月12日.xlsx');

  try {
    // Check if files exist
    if (!fs.existsSync(generatedFile)) {
      console.error(`❌ 生成文件不存在: ${generatedFile}`);
      process.exit(1);
    }
    if (!fs.existsSync(referenceFile)) {
      console.error(`❌ 预期文件不存在: ${referenceFile}`);
      process.exit(1);
    }

    console.log('✓ 文件存在，开始读取...\n');

    // Load workbooks
    const generatedWb = new ExcelJS.Workbook();
    const referenceWb = new ExcelJS.Workbook();

    await generatedWb.xlsx.readFile(generatedFile);
    await referenceWb.xlsx.readFile(referenceFile);

    const generatedSheets = generatedWb.worksheets;
    const referenceSheets = referenceWb.worksheets;

    console.log('='.repeat(80));
    console.log('## 总体对比摘要');
    console.log('='.repeat(80));
    console.log(`- 生成文件 sheet 数：${generatedSheets.length} 个`);
    console.log(`- 预期文件 sheet 数：${referenceSheets.length} 个`);
    console.log(`- 生成文件：${path.basename(generatedFile)}`);
    console.log(`- 预期文件：${path.basename(referenceFile)}`);
    console.log();

    // Sheet-level comparison
    console.log('='.repeat(80));
    console.log('## Sheet 级差异');
    console.log('='.repeat(80));
    console.log('| Sheet 名 | 生成 | 预期 | 状态 |');
    console.log('|---------|------|------|------|');

    const maxSheets = Math.max(generatedSheets.length, referenceSheets.length);
    const sheetComparisons = [];

    for (let i = 0; i < maxSheets; i++) {
      const genSheet = generatedSheets[i];
      const refSheet = referenceSheets[i];
      
      const genName = genSheet ? genSheet.name : '-';
      const refName = refSheet ? refSheet.name : '-';
      const status = genName === refName ? '✓' : '✗';

      console.log(`| ${genName} | ${genName} | ${refName} | ${status} |`);
      sheetComparisons.push({
        index: i,
        genSheet,
        refSheet,
        genName,
        refName,
        match: genName === refName
      });
    }
    console.log();

    // Detailed sheet comparison
    console.log('='.repeat(80));
    console.log('## 逐 Sheet 详细差异');
    console.log('='.repeat(80));

    for (const comp of sheetComparisons) {
      if (!comp.genSheet && !comp.refSheet) continue;

      const sheetName = comp.genName !== '-' ? comp.genName : comp.refName;
      console.log(`\n### Sheet: ${sheetName}`);
      console.log('-'.repeat(60));

      if (!comp.genSheet) {
        console.log('⚠️  预期文件中有此 sheet，但生成文件中缺失');
        continue;
      }
      if (!comp.refSheet) {
        console.log('⚠️  生成文件中有此 sheet，但预期文件中不存在');
        continue;
      }

      const genSheet = comp.genSheet;
      const refSheet = comp.refSheet;

      // Get actual dimensions
      const genDim = getSheetDimensions(genSheet);
      const refDim = getSheetDimensions(refSheet);

      console.log('\n#### 结构差异');
      console.log(`- 行数：生成 ${genDim.rows} 行，预期 ${refDim.rows} 行（差 ${genDim.rows - refDim.rows > 0 ? '+' : ''}${genDim.rows - refDim.rows}）`);
      console.log(`- 列数：生成 ${genDim.cols} 列，预期 ${refDim.cols} 列（差 ${genDim.cols - refDim.cols > 0 ? '+' : ''}${genDim.cols - refDim.cols}）`);

      // Check merged cells
      const genMerged = genSheet.model.mergedCells || [];
      const refMerged = refSheet.model.mergedCells || [];
      if (JSON.stringify(genMerged) !== JSON.stringify(refMerged)) {
        console.log(`- 合并单元格：生成 ${Object.keys(genMerged).length} 个，预期 ${Object.keys(refMerged).length} 个 ✗`);
      } else {
        console.log(`- 合并单元格：一致 ✓`);
      }

      // Data comparison
      const dataDiffs = compareData(genSheet, refSheet, genDim, refDim);
      if (dataDiffs.length > 0) {
        console.log('\n#### 数据差异');
        dataDiffs.slice(0, 40).forEach(diff => {
          console.log(`- ${diff}`);
        });
        if (dataDiffs.length > 40) {
          console.log(`- ... 还有 ${dataDiffs.length - 40} 处差异（OUTPUT_LIMIT: 40）`);
        }
      } else {
        console.log('\n#### 数据差异');
        console.log('- 数据完全一致 ✓');
      }

      // Style comparison (sampling)
      const styleDiffs = compareStyles(genSheet, refSheet, genDim, refDim);
      if (styleDiffs.length > 0) {
        console.log('\n#### 样式差异');
        styleDiffs.slice(0, 20).forEach(diff => {
          console.log(`${diff}`);
        });
        if (styleDiffs.length > 20) {
          console.log(`- ... 还有 ${styleDiffs.length - 20} 处样式差异（OUTPUT_LIMIT: 20）`);
        }
      } else {
        console.log('\n#### 样式差异');
        console.log('- 样式一致 ✓');
      }

      // Dimension comparison (column widths, row heights)
      const dimDiffs = compareDimensions(genSheet, refSheet, genDim, refDim);
      if (dimDiffs.length > 0) {
        console.log('\n#### 格局差异');
        dimDiffs.slice(0, 20).forEach(diff => {
          console.log(`- ${diff}`);
        });
        if (dimDiffs.length > 20) {
          console.log(`- ... 还有 ${dimDiffs.length - 20} 处差异（OUTPUT_LIMIT: 20）`);
        }
      } else {
        console.log('\n#### 格局差异');
        console.log('- 格局一致 ✓');
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('对比完成 ✓');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

function getSheetDimensions(sheet) {
  let maxRow = 0;
  let maxCol = 0;

  sheet.eachRow((row, rowNum) => {
    maxRow = Math.max(maxRow, rowNum);
    row.eachCell((cell, colNum) => {
      if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
        maxCol = Math.max(maxCol, colNum);
      }
    });
  });

  return { rows: maxRow, cols: maxCol };
}

function getCellAddress(row, col) {
  let colStr = '';
  let c = col;
  while (c > 0) {
    c--;
    colStr = String.fromCharCode(65 + (c % 26)) + colStr;
    c = Math.floor(c / 26);
  }
  return `${colStr}${row}`;
}

function compareData(genSheet, refSheet, genDim, refDim) {
  const diffs = [];
  const maxRows = Math.max(genDim.rows, refDim.rows);
  const maxCols = Math.max(genDim.cols, refDim.cols);

  for (let row = 1; row <= maxRows; row++) {
    for (let col = 1; col <= maxCols; col++) {
      const genCell = genSheet.getCell(row, col);
      const refCell = refSheet.getCell(row, col);

      const genValue = getCellValue(genCell);
      const refValue = getCellValue(refCell);

      if (genValue !== refValue) {
        const addr = getCellAddress(row, col);
        diffs.push(`${addr}：生成 "${genValue}" ≠ 预期 "${refValue}"`);
      }
    }
  }

  return diffs;
}

function getCellValue(cell) {
  if (cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'object' && cell.value.result !== undefined) {
    return cell.value.result || '';
  }
  return String(cell.value);
}

function compareStyles(genSheet, refSheet, genDim, refDim) {
  const diffs = [];
  const maxRows = Math.max(genDim.rows, refDim.rows);
  const maxCols = Math.max(genDim.cols, refDim.cols);

  // Sample: rows 1-50, cols 1-15
  for (let row = 1; row <= Math.min(maxRows, 50); row++) {
    for (let col = 1; col <= Math.min(maxCols, 15); col++) {
      const genCell = genSheet.getCell(row, col);
      const refCell = refSheet.getCell(row, col);

      const styleDiff = compareCellStyle(genCell, refCell);
      if (styleDiff) {
        const addr = getCellAddress(row, col);
        diffs.push(`- ${addr}：${styleDiff}`);
      }
    }
  }

  return diffs;
}

function compareCellStyle(genCell, refCell) {
  const diffs = [];

  if (JSON.stringify(genCell.font || {}) !== JSON.stringify(refCell.font || {})) {
    diffs.push('字体');
  }

  if (JSON.stringify(genCell.fill || {}) !== JSON.stringify(refCell.fill || {})) {
    diffs.push('填充');
  }

  if (JSON.stringify(genCell.border || {}) !== JSON.stringify(refCell.border || {})) {
    diffs.push('边框');
  }

  if (JSON.stringify(genCell.alignment || {}) !== JSON.stringify(refCell.alignment || {})) {
    diffs.push('对齐');
  }

  if ((genCell.numFmt || '') !== (refCell.numFmt || '')) {
    diffs.push('数字格式');
  }

  return diffs.length > 0 ? diffs.join(', ') : null;
}

function compareDimensions(genSheet, refSheet, genDim, refDim) {
  const diffs = [];

  // Compare column widths
  for (let col = 1; col <= Math.min(genDim.cols, refDim.cols); col++) {
    const genWidth = genSheet.getColumn(col).width;
    const refWidth = refSheet.getColumn(col).width;

    if (genWidth !== refWidth) {
      const colName = getCellAddress(1, col).split('1')[0];
      diffs.push(`列 ${colName} 宽度：生成 ${genWidth || '默认'} ≠ 预期 ${refWidth || '默认'}`);
    }
  }

  // Compare row heights (sample first 30 rows)
  for (let row = 1; row <= Math.min(30, genDim.rows, refDim.rows); row++) {
    const genHeight = genSheet.getRow(row).height;
    const refHeight = refSheet.getRow(row).height;

    if (genHeight !== refHeight) {
      diffs.push(`行 ${row} 高度：生成 ${genHeight || '默认'} ≠ 预期 ${refHeight || '默认'}`);
    }
  }

  return diffs;
}
