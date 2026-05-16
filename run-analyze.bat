@echo off
setlocal enabledelayedexpansion

cd /d "c:\Users\XXK\Desktop\work\excel tools\excel-tools"

echo.
echo ========================================
echo 分析 Excel 文件内部结构
echo ========================================
echo.

set xlsx_file=test\华锐捷.xlsx

echo 📦 检查文件存在性...
if not exist "%xlsx_file%" (
    echo ❌ 文件不存在: %xlsx_file%
    exit /b 1
)

echo ✅ 文件存在: %xlsx_file%
echo.

echo 📊 运行 Python 分析脚本...
echo.

python analyze-xlsx.py

pause
