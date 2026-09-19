# Antigravity-Plus Smart Launcher & Self-Healing Engine
[CmdletBinding()]
param (
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$AppArgs
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $ScriptDir
$PatcherJs = Join-Path $RepoRoot "core\patcher.js"

# 1. Query current patch & proxy status
$statusJson = & node "$PatcherJs" --status 2>$null
if (-not $statusJson) {
    Write-Host "[Antigravity-Plus] 警告: 未能检测到 Node.js 环境或状态检查失败，尝试直接启动..." -ForegroundColor Yellow
    $defaultExe = "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe"
    if (Test-Path $defaultExe) {
        Start-Process -FilePath $defaultExe -ArgumentList $AppArgs
        exit 0
    }
    exit 1
}

$status = $statusJson | ConvertFrom-Json

if (-not $status.isInstalled) {
    Write-Host "[Antigravity-Plus] 错误: 未能在系统中检测到 Antigravity 安装。" -ForegroundColor Red
    Write-Host "请确认客户端已安装在默认路径或指定安装目录。"
    exit 1
}

$exePath = Join-Path $status.installDir "Antigravity.exe"

# 2. Check if self-healing is required (e.g. after official auto-update)
if ($status.needsHealing) {
    Write-Host "[Antigravity-Plus] 🔄 检测到客户端已由官方更新（或汉化/代理组件缺失）。" -ForegroundColor Cyan
    Write-Host "[Antigravity-Plus] ⚡ 正在执行毫秒级自愈与自动重新注入..." -ForegroundColor Cyan

    & node "$PatcherJs" --auto-heal
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[Antigravity-Plus] 警告: 自愈注入异常，仍将尝试拉起客户端..." -ForegroundColor Yellow
    } else {
        Write-Host "[Antigravity-Plus] ✅ 自愈成功完成！" -ForegroundColor Green
    }
}

# 3. Launch Antigravity.exe
if (Test-Path $exePath) {
    Start-Process -FilePath $exePath -ArgumentList $AppArgs -WorkingDirectory $status.installDir
    exit 0
} else {
    Write-Host "[Antigravity-Plus] 错误: 未找到可执行文件: $exePath" -ForegroundColor Red
    exit 1
}
