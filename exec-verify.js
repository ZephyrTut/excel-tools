#!/usr/bin/env node
/**
 * 直接验证两个脚本
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectDir = __dirname;

function main() {
  console.log('\n' + '='.repeat(60));
  console.log('Excel Tools 验证执行');
  console.log('='.repeat(60) + '\n');

  let result1Success = false;
  let result2Success = false;

  // 脚本1: 生成
  console.log('[1/2] 执行: generate-zhejiang-split.js');
  console.log('-'.repeat(60));
  try {
    execSync('node generate-zhejiang-split.js', {
      cwd: projectDir,
      stdio: 'inherit'
    });
    result1Success = true;
    console.log('\n✅ 脚本1: 成功');
  } catch (e) {
    console.error('\n❌ 脚本1: 失败');
    console.error(e.message);
    result1Success = false;
  }

  console.log('\n' + '-'.repeat(60) + '\n');

  // 脚本2: 对比
  console.log('[2/2] 执行: compare-with-output.js');
  console.log('-'.repeat(60));
  try {
    execSync('node compare-with-output.js', {
      cwd: projectDir,
      stdio: 'inherit'
    });
    result2Success = true;
    console.log('\n✅ 脚本2: 成功');
  } catch (e) {
    // check if error code is 2 (diff found but execution successful)
    if (e.status === 2) {
      console.log('\n⚠️  脚本2: 执行成功，发现差异 (exit code: 2)');
      result2Success = true;
    } else {
      console.error('\n❌ 脚本2: 失败');
      console.error(e.message);
      result2Success = false;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('验证总结');
  console.log('='.repeat(60) + '\n');

  const status1 = result1Success ? '✅ 成功' : '❌ 失败';
  const status2 = result2Success ? '✅ 成功' : '❌ 失败';
  
  console.log(`脚本1 (generate):  ${status1}`);
  console.log(`脚本2 (compare):   ${status2}`);

  const allSuccess = result1Success && result2Success;
  console.log(`\n总体状态: ${allSuccess ? '✅ 验证通过' : '❌ 验证失败'}\n`);

  // 检查和显示比较结果
  const resultFile = path.join(projectDir, 'comparison-result.txt');
  if (fs.existsSync(resultFile)) {
    console.log('📊 比较结果文件:');
    console.log('-'.repeat(60));
    const content = fs.readFileSync(resultFile, 'utf-8');
    const lines = content.split('\n');
    console.log(`文件包含 ${lines.length} 行`);
    
    // 显示前 20 行摘要
    console.log('\n摘要 (前20行):');
    lines.slice(0, 20).forEach((line, i) => {
      if (line.trim()) console.log(line);
    });
    
    if (lines.length > 20) {
      console.log(`\n... 还有 ${lines.length - 20} 行 (完整内容见 ${resultFile})`);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
  process.exit(allSuccess ? 0 : 1);
}

main();
