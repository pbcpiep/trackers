<#
  Nightly backup of Actual Budget on Windows (the "keep Windows" setup).
  Copies the data folder into a dated .zip and keeps the newest 14.

  One-time setup (Admin PowerShell, from this folder):
    powershell -ExecutionPolicy Bypass -File .\actual-backup.ps1 -Install
  Run a backup by hand:
    powershell -ExecutionPolicy Bypass -File .\actual-backup.ps1
#>
param(
  [string]$ActualDir = 'C:\actual',
  [string]$BackupDir = "$env:USERPROFILE\Documents\Actual Backups",
  [int]$Keep = 14,
  [switch]$Install
)
$ErrorActionPreference = 'Stop'

if ($Install) {
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -ActualDir `"$ActualDir`" -BackupDir `"$BackupDir`" -Keep $Keep"
  $trigger = New-ScheduledTaskTrigger -Daily -At 3:30am
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
  Register-ScheduledTask -TaskName 'Actual Budget backup' -Action $action -Trigger $trigger -Settings $settings -Description 'Nightly Actual Budget backup' -Force | Out-Null
  Write-Host 'Scheduled: every night at 3:30am (or at the next startup if the PC was off).' -ForegroundColor Green
  return
}

$data = Join-Path $ActualDir 'data'
if (-not (Test-Path $data)) { throw "Actual data folder not found: $data" }
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$out = Join-Path $BackupDir ('actual-{0:yyyy-MM-dd-HHmmss}.zip' -f (Get-Date))

# Stop Actual briefly so its database files are copied in a consistent state.
Push-Location $ActualDir
try {
  $running = (docker compose ps --status running -q actual) -ne $null
  if ($running) { docker compose stop -t 20 actual | Out-Null }
  try {
    Compress-Archive -Path $data -DestinationPath $out -Force
  } finally {
    if ($running) { docker compose start actual | Out-Null }
  }
} finally { Pop-Location }

Get-ChildItem $BackupDir -Filter 'actual-*.zip' | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Keep | Remove-Item -Force
Write-Host "Backup OK: $out"
