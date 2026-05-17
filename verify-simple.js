#!/usr/bin/env node

/**
 * 验证脚本 - 顺序运行两个脚本并收集结果
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = __dirname;

console.log('\n========== Excel Tools 验证开始 ==========\n');

const results = {};

// 1. 运行生成脚本
console.log('[1/2] 运行 generate-zhejiang-split.js...\n');
try {
  const output1 = execSync('node generate-zhejiang-split.js', {
    cwd: projectDir,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024
  });
  console.log(output1);
  results.generate = { success: true, message: '✅ 生成脚本执行成功' };
} catch (error) {
  console.error(error.stdout || error.message);
  results.generate = { 
    success: false, 
    message: `❌ 生成脚本失败 (exit code: ${error.status})`,
    error: error.message 
  };
}

console.log('\n========================================\n');

// 2. 运行对比脚本
console.log('[2/2] 运行 compare-with-output.js...\n');
try {
  const output2 = execSync('node compare-with-output.js', {
    cwd: projectDir,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
    stdio: 'pipe'
  });
  console.log(output2);
  results.compare = { success: true, message: '✅ 对比脚本执行成功' };
} catch (error) {
  // exit code 2 表示有差异但成功执行
  const isWithDiff = error.status === 2;
  console.log(error.stdout || '');
  if (error.stderr) {
    console.error(error.stderr);
  }
  
  results.compare = { 
    success: !isWithDiff || error.status === 0, 
    message: isWithDiff 
      ? '⚠️  对比脚本完成，发现差异' 
      : `❌ 对比脚本失败 (exit code: ${error.status})`,
    error: !isWithDiff ? error.message : undefined
  };
}

console.log('\n========================================');
console.log('验证总结:');
console.log('========================================\n');
console.log(results.generate.message);
console.log(results.compare.message);

// 最后检查比较结果文件
const resultFile = path.join(projectDir, 'comparison-result.txt');
if (fs.existsSync(resultFile)) {
  console.log(`\n📊 详细比较结果已保存到: ${resultFile}`);
  const content = fs.readFileSync(resultFile, 'utf-8');
  const lines = content.split('\n');
  console.log(`\n📈 结果摘要 (前30行):`);
  console.log(lines.slice(0, 30).join('\n'));
  if (lines.length > 30) {
    console.log(`\n... 还有 ${lines.length - 30} 行 (查看文件获取完整结果)`);
  }
}

const allSuccess = results.generate.success && results.compare.success;
console.log(`\n总体状态: ${allSuccess ? '✅ 验证通过' : '❌ 验证失败'}\n`);

process.exit(allSuccess ? 0 : 1);
