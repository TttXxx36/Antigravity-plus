# Antigravity-Plus Desktop & Start Menu Shortcut Creator
[CmdletBinding()]
param (
    [switch]$Remove
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot = Split-Path -Parent $ScriptDir
$BatLauncher = Join-Path $ScriptDir "Antigravity-Plus.bat"

$DesktopPath = [Environment]::GetFolderPath("Desktop")
$StartMenuPath = [Environment]::GetFolderPath("Programs")

$DesktopShortcut = Join-Path $DesktopPath "Antigravity (Plus).lnk"
$StartMenuShortcut = Join-Path $StartMenuPath "Antigravity (Plus).lnk"

if ($Remove) {
    if (Test-Path $DesktopShortcut) {
        Remove-Item $DesktopShortcut -Force
        Write-Host "[快捷方式] 已移除桌面快捷方式: Antigravity (Plus)" -ForegroundColor Green
    }
    if (Test-Path $StartMenuShortcut) {
        Remove-Item $StartMenuShortcut -Force
        Write-Host "[快捷方式] 已移除开始菜单快捷方式: Antigravity (Plus)" -ForegroundColor Green
    }
    exit 0
}

# Resolve target Antigravity.exe for icon
$StatusJson = & node "$RepoRoot\core\patcher.js" --status 2>$null
$IconPath = ""
if ($StatusJson) {
    $Status = $StatusJson | ConvertFrom-Json
    if ($Status.isInstalled) {
        $IconPath = Join-Path $Status.installDir "Antigravity.exe"
    }
}
if (-not $IconPath -or -not (Test-Path $IconPath)) {
    $IconPath = "$env:LOCALAPPDATA\Programs\antigravity\Antigravity.exe"
}

$WshShell = New-Object -ComObject WScript.Shell

# 1. Create Desktop Shortcut
$Shortcut = $WshShell.CreateShortcut($DesktopShortcut)
$Shortcut.TargetPath = $BatLauncher
$Shortcut.WorkingDirectory = $RepoRoot
$Shortcut.Description = "Antigravity (Plus) - 汉化与强制代理智能启动器"
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
}
$Shortcut.Save()
Write-Host "[快捷方式] 成功创建桌面快捷方式: Antigravity (Plus)" -ForegroundColor Green

# 2. Create Start Menu Shortcut
$SmShortcut = $WshShell.CreateShortcut($StartMenuShortcut)
$SmShortcut.TargetPath = $BatLauncher
$SmShortcut.WorkingDirectory = $RepoRoot
$SmShortcut.Description = "Antigravity (Plus) - 汉化与强制代理智能启动器"
if (Test-Path $IconPath) {
    $SmShortcut.IconLocation = "$IconPath,0"
}
$SmShortcut.Save()
Write-Host "[快捷方式] 成功创建开始菜单快捷方式: Antigravity (Plus)" -ForegroundColor Green
