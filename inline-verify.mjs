import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runScript(scriptName) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`▶ 执行: ${scriptName}`);
    console.log('='.repeat(50));
    
    const proc = spawn('node', [scriptName], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    proc.on('close', (code) => {
      resolve(code);
    });
    
    proc.on('error', (err) => {
      console.error(`❌ 启动失败: ${err.message}`);
      resolve(1);
    });
  });
}

async function main() {
  console.log('========== Excel Tools 验证 ==========\n');
  
  const code1 = await runScript('generate-zhejiang-split.js');
  console.log(`\n✓ generate-zhejiang-split.js 结束 (exit code: ${code1})`);
  
  const code2 = await runScript('compare-with-output.js');
  console.log(`\n✓ compare-with-output.js 结束 (exit code: ${code2})`);
  
  console.log('\n' + '='.repeat(50));
  console.log('验证完成');
  console.log('='.repeat(50));
  console.log(`脚本1: ${code1 === 0 ? '✅ 成功' : `❌ 失败 (code: ${code1})`}`);
  console.log(`脚本2: ${code2 === 0 || code2 === 2 ? '✅ 成功' : `❌ 失败 (code: ${code2})`}`);
  
  const success = code1 === 0 && (code2 === 0 || code2 === 2);
  console.log(`\n总体: ${success ? '✅ 通过' : '❌ 失败'}\n`);
}

main();
