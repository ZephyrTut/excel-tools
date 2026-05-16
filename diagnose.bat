@echo off
REM 使用 Windows 自带的 tar/7z 命令查看 xlsx 内部
setlocal enabledelayedexpansion

set xlsx=test\华锐捷.xlsx
set xlsx_full="%cd%\%xlsx%"

echo 💾 Excel 文件诊断报告
echo ========================
echo 文件路径: %xlsx_full%
echo.

if not exist "%xlsx%" (
    echo ❌ 文件不存在
    exit /b 1
)

REM 获取文件大小
for %%A in ("%xlsx%") do (
    set size=%%~zA
    set /a size_mb=!size! / 1048576
    set /a size_kb=!size! / 1024
    echo 📦 文件大小: !size_kb! KB ^(!size_mb! MB^)
)

echo.
echo 🔍 解压并分析内部结构...
echo.

REM 尝试用 Python 快速分析
python -c "
import zipfile
from pathlib import Path

xlsx = Path('test/华锐捷.xlsx')
with zipfile.ZipFile(xlsx, 'r') as zf:
    print('📋 ZIP 内部文件清单:\n')
    
    categories = {}
    for info in sorted(zf.infolist(), key=lambda x: x.file_size, reverse=True):
        size_kb = info.file_size / 1024
        
        cat = '其他'
        if 'sheet' in info.filename.lower():
            cat = 'Sheet'
        elif 'media' in info.filename.lower():
            cat = '图片'
        elif 'styles' in info.filename:
            cat = '样式'
        elif 'sharedStrings' in info.filename:
            cat = '字符串'
        
        if cat not in categories:
            categories[cat] = 0
        categories[cat] += info.file_size
        
        if size_kb > 10:
            print(f'{info.filename:50s} {size_kb:8.1f} KB')
    
    print('\n' + '='*60)
    print('按类别统计:')
    print('='*60)
    for cat in sorted(categories, key=lambda x: categories[x], reverse=True):
        size_mb = categories[cat] / 1024 / 1024
        print(f'{cat:15s}: {size_mb:6.2f} MB')
" 2>&1

echo.
pause
