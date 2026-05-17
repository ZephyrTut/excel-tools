#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

async function runCommand(script, name) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${name}] 开始执行...`);
    console.log(`${'='.repeat(60)}`);
    
    const proc = spawn('node', [script], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    proc.on('close', (code) => {
      const status = code === 0 ? '✅ 成功' : `❌ 失败 (exit code: ${code})`;
      console.log(`\n[${name}] ${status}`);
      resolve({ name, code, status });
    });
    
    proc.on('error', (err) => {
      console.error(`[${name}] 错误:`, err.message);
      resolve({ name, code: 1, status: `❌ 错误: ${err.message}` });
    });
  });
}

async function main() {
  const results = [];
  
  // 运行两个脚本
  results.push(await runCommand('generate-zhejiang-split.js', '脚本1: 生成浙江分割'));
  results.push(await runCommand('compare-with-output.js', '脚本2: 对比输出'));
  
  // 输出总结
  console.log(`\n${'='.repeat(60)}`);
  console.log('验证总结:');
  console.log(`${'='.repeat(60)}`);
  results.forEach(r => {
    console.log(`${r.name}: ${r.status}`);
  });
  
  const allSuccess = results.every(r => r.code === 0);
  console.log(`\n总体状态: ${allSuccess ? '✅ 全部通过' : '❌ 存在失败'}`);
}

main().catch(console.error);
