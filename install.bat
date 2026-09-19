@echo off
setlocal
chcp 65001 >nul
title Antigravity-Plus 一键安装与配置

echo ========================================================
echo   Antigravity-Plus 增强套件（汉化 + 免 TUN 代理 + 自动自愈）
echo ========================================================
echo.

:: 1. Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境，请先安装 Node.js (v16+) 后再运行本脚本。
    echo 官方下载: https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Execute Patch & Proxy Deployment
node "%~dp0core\patcher.js" --install %*
if %errorlevel% neq 0 (
    echo.
    echo [错误] 安装部署过程中出现异常，请检查上方日志。
    pause
    exit /b 1
)

:: 3. Create Desktop and Start Menu Shortcuts
echo.
echo >>> 步骤 3/3: 正在创建智能自愈启动器快捷方式...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\create_shortcut.ps1"

echo.
echo ========================================================
echo   🎉 安装部署圆满完成！
echo.
echo   【核心提示】
echo   - 以后请直接通过桌面的【Antigravity (Plus)】快捷方式启动。
echo   - 当客户端有官方版本升级时，启动器会自动在启动前完成补丁自愈！
echo   - 代理默认监听 127.0.0.1:7890 (SOCKS5)，如需修改可编辑安装目录下的 config.json
echo ========================================================
echo.
pause
endlocal
