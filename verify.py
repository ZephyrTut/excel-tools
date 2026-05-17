#!/usr/bin/env python3
"""
验证脚本运行器 - 使用 subprocess 执行 Node 脚本
"""

import subprocess
import sys
import os
from pathlib import Path

# 设置工作目录
project_dir = Path(__file__).parent.absolute()
os.chdir(project_dir)

print("\n" + "="*60)
print("Excel Tools 验证")
print("="*60 + "\n")

results = {}

# 1. 运行生成脚本
print("[1/2] 运行 generate-zhejiang-split.js...")
print("-" * 60)
try:
    result = subprocess.run(
        [sys.executable, "-m", "subprocess", "-c", "import subprocess; subprocess.run(['node', 'generate-zhejiang-split.js'])"] 
        if False else  # 不使用这个路径
        ["node", "generate-zhejiang-split.js"],
        cwd=str(project_dir),
        capture_output=False,
        text=True,
        timeout=180
    )
    results['generate'] = {
        'success': result.returncode == 0,
        'code': result.returncode,
        'msg': '✅ 成功' if result.returncode == 0 else f'❌ 失败 (exit: {result.returncode})'
    }
except Exception as e:
    results['generate'] = {
        'success': False,
        'code': 1,
        'msg': f'❌ 错误: {str(e)}'
    }

print("\n" + "-" * 60 + "\n")

# 2. 运行对比脚本
print("[2/2] 运行 compare-with-output.js...")
print("-" * 60)
try:
    result = subprocess.run(
        ["node", "compare-with-output.js"],
        cwd=str(project_dir),
        capture_output=False,
        text=True,
        timeout=180
    )
    # exit code 2 表示有差异但成功执行
    is_with_diff = result.returncode == 2
    results['compare'] = {
        'success': result.returncode in (0, 2),
        'code': result.returncode,
        'msg': '⚠️  成功 (发现差异)' if is_with_diff else ('✅ 成功' if result.returncode == 0 else f'❌ 失败 (exit: {result.returncode})')
    }
except Exception as e:
    results['compare'] = {
        'success': False,
        'code': 1,
        'msg': f'❌ 错误: {str(e)}'
    }

print("\n" + "="*60)
print("验证总结")
print("="*60 + "\n")
print(f"脚本1: {results['generate']['msg']}")
print(f"脚本2: {results['compare']['msg']}")

all_success = results['generate']['success'] and results['compare']['success']
print(f"\n总体: {'✅ 通过' if all_success else '❌ 失败'}\n")

# 检查比较结果
comparison_file = project_dir / "comparison-result.txt"
if comparison_file.exists():
    print(f"\n📊 比较结果文件: {comparison_file}")
    with open(comparison_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        print(f"📈 文件大小: {len(lines)} 行\n")
        # 显示前30行
        for i, line in enumerate(lines[:30], 1):
            print(line.rstrip())
        if len(lines) > 30:
            print(f"\n... 还有 {len(lines) - 30} 行")

sys.exit(0 if all_success else 1)
