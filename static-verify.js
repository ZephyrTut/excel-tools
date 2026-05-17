#!/usr/bin/env node
/**
 * 静态验证脚本 - 检查所有依赖和配置是否正确
 */

const fs = require('fs');
const path = require('path');

const projectDir = __dirname;

console.log('\n' + '='.repeat(70));
console.log('Excel Tools 静态验证');
console.log('='.repeat(70) + '\n');

const checks = [];

// 检查 1: generate-zhejiang-split.js 的依赖
console.log('[检查 1] generate-zhejiang-split.js 依赖验证');
console.log('-'.repeat(70));
try {
  const splitScript = path.join(projectDir, 'generate-zhejiang-split.js');
  if (!fs.existsSync(splitScript)) {
    checks.push({ name: '脚本存在', status: '❌', detail: '找不到 generate-zhejiang-split.js' });
  } else {
    checks.push({ name: '脚本存在', status: '✅' });
    
    // 检查依赖模块
    const deps = [
      './services/split/splitService',
      './test/华锐捷2.xlsx',
      './test/浙江华锐捷技术有限公司日报表(2).xlsx'
    ];
    
    for (const dep of deps) {
      const fullPath = path.join(projectDir, dep);
      if (fs.existsSync(fullPath)) {
        checks.push({ name: `  └─ ${dep}`, status: '✅' });
      } else {
        checks.push({ name: `  └─ ${dep}`, status: '❌', detail: '缺失' });
      }
    }
  }
} catch (e) {
  checks.push({ name: '脚本1检查', status: '❌', detail: e.message });
}

console.log();

// 检查 2: compare-with-output.js 的依赖
console.log('[检查 2] compare-with-output.js 依赖验证');
console.log('-'.repeat(70));
try {
  const compareScript = path.join(projectDir, 'compare-with-output.js');
  if (!fs.existsSync(compareScript)) {
    checks.push({ name: '脚本存在', status: '❌', detail: '找不到 compare-with-output.js' });
  } else {
    checks.push({ name: '脚本存在', status: '✅' });
    
    // 检查依赖模块
    const deps = [
      './excel-compare-core.js',
      './test/浙江华锐捷技术有限公司日报表(2).xlsx'
    ];
    
    for (const dep of deps) {
      const fullPath = path.join(projectDir, dep);
      if (fs.existsSync(fullPath)) {
        checks.push({ name: `  └─ ${dep}`, status: '✅' });
      } else {
        checks.push({ name: `  └─ ${dep}`, status: '❌', detail: '缺失' });
      }
    }
  }
} catch (e) {
  checks.push({ name: '脚本2检查', status: '❌', detail: e.message });
}

console.log();

// 检查 3: Node modules
console.log('[检查 3] 依赖包验证');
console.log('-'.repeat(70));
try {
  const nodeModules = path.join(projectDir, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    checks.push({ name: 'node_modules', status: '❌', detail: '未安装' });
  } else {
    checks.push({ name: 'node_modules', status: '✅' });
    
    const requiredPkgs = ['exceljs'];
    for (const pkg of requiredPkgs) {
      const pkgPath = path.join(nodeModules, pkg);
      if (fs.existsSync(pkgPath)) {
        checks.push({ name: `  └─ ${pkg}`, status: '✅' });
      } else {
        checks.push({ name: `  └─ ${pkg}`, status: '❌', detail: '未安装' });
      }
    }
  }
} catch (e) {
  checks.push({ name: 'Node模块检查', status: '❌', detail: e.message });
}

console.log();

// 检查 4: 输出目录
console.log('[检查 4] 输出目录验证');
console.log('-'.repeat(70));
try {
  const outputDir = path.join(projectDir, 'output');
  if (!fs.existsSync(outputDir)) {
    checks.push({ name: 'output 目录', status: '⚠️ ', detail: '不存在 (会自动创建)' });
  } else {
    checks.push({ name: 'output 目录', status: '✅', detail: `包含 ${fs.readdirSync(outputDir).length} 个文件` });
  }
} catch (e) {
  checks.push({ name: '输出目录检查', status: '❌', detail: e.message });
}

console.log();

// 检查 5: 现有比较结果
console.log('[检查 5] 比较结果文件');
console.log('-'.repeat(70));
try {
  const resultFile = path.join(projectDir, 'comparison-result.txt');
  if (fs.existsSync(resultFile)) {
    const content = fs.readFileSync(resultFile, 'utf-8');
    const lines = content.split('\n').length;
    checks.push({ name: 'comparison-result.txt', status: '✅', detail: `${lines} 行` });
  } else {
    checks.push({ name: 'comparison-result.txt', status: '⚠️ ', detail: '不存在 (首次运行会生成)' });
  }
} catch (e) {
  checks.push({ name: '结果文件检查', status: '❌', detail: e.message });
}

console.log('\n' + '='.repeat(70));
console.log('验证结果');
console.log('='.repeat(70) + '\n');

checks.forEach(check => {
  const detail = check.detail ? ` - ${check.detail}` : '';
  console.log(`${check.status} ${check.name}${detail}`);
});

// 统计
const passed = checks.filter(c => c.status === '✅').length;
const failed = checks.filter(c => c.status === '❌').length;
const warnings = checks.filter(c => c.status === '⚠️ ').length;

console.log('\n' + '-'.repeat(70));
console.log(`✅ 通过: ${passed} | ❌ 失败: ${failed} | ⚠️  警告: ${warnings}`);
console.log('-'.repeat(70) + '\n');

const allOk = failed === 0;
console.log(`总体: ${allOk ? '✅ 所有检查通过，脚本可以执行' : '❌ 存在失败项，脚本无法执行'}\n`);

process.exit(allOk ? 0 : 1);
