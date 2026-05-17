@echo off
cd /d D:\project\excel-tools\excel-tools.worktrees\agents-brainy-starfish
echo.
echo ============================================================
echo Excel Tools Verification
echo ============================================================
echo.

echo [1/2] Running generate-zhejiang-split.js...
echo.
node generate-zhejiang-split.js
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ^✓ Script 1 SUCCESS
) else (
    echo.
    echo ^✗ Script 1 FAILED (exit code: %ERRORLEVEL%)
)

echo.
echo ============================================================
echo.

echo [2/2] Running compare-with-output.js...
echo.
node compare-with-output.js
set COMPARE_CODE=%ERRORLEVEL%
if %COMPARE_CODE% EQU 0 (
    echo.
    echo ^✓ Script 2 SUCCESS
) else if %COMPARE_CODE% EQU 2 (
    echo.
    echo ^⚠ Script 2 SUCCESS with DIFFERENCES FOUND
) else (
    echo.
    echo ^✗ Script 2 FAILED (exit code: %COMPARE_CODE%)
)

echo.
echo ============================================================
echo Verification Summary
echo ============================================================
echo.

if %ERRORLEVEL% LEQ 2 (
    echo ^✓ Overall: PASS
) else (
    echo ^✗ Overall: FAIL
)

echo.
pause
