@echo off
setlocal
chcp 65001 >nul
title Antigravity-Plus 一键卸载与官方原版还原

echo ========================================================
echo   Antigravity-Plus 卸载还原
echo ========================================================
echo.

node "%~dp0core\patcher.js" --uninstall %*
if %errorlevel% neq 0 (
    echo.
    echo [错误] 还原过程中出现异常。
    pause
    exit /b 1
)

echo.
echo >>> 正在清理快捷方式...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\create_shortcut.ps1" -Remove

echo.
echo ========================================================
echo   [√] 客户端已恢复为官方原生英文状态，组件与快捷方式已清理。
echo ========================================================
echo.
pause
endlocal
