@echo off
setlocal
chcp 65001 >nul

:: Launch the smart launcher via PowerShell with bypass execution policy
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_launcher.ps1" %*

endlocal
