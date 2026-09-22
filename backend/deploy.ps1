<#
.SYNOPSIS
  Google Cloud Run 自動部署腳本 (PowerShell)
.DESCRIPTION
  自動載入同目錄下的 cloudrun.env 設定檔，並以鎖定規格進行 Cloud Run 服務部署：
  - 執行個體數量下限: 0 (Min Instances)
  - 執行個體數量上限: 2 (Max Instances)
  - CPU: 1
  - RAM: 256MB (256Mi)
  - 區域: us-central1
#>

param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $scriptDir "cloudrun.env"

if (-not (Test-Path $envFile)) {
  Write-Error "找不到 Cloud Run 部署設定檔: $envFile"
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Google Cloud Run 部署程序 (Digital Garage Backend)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 解析 cloudrun.env
$config = @{}
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#")) {
    $parts = $line -split "=", 2
    if ($parts.Length -eq 2) {
      $config[$parts[0].Trim()] = $parts[1].Trim()
    }
  }
}

$serviceName = if ($config.ContainsKey("SERVICE_NAME")) { $config["SERVICE_NAME"] } else { "digital-garage-api" }
$region      = if ($config.ContainsKey("REGION")) { $config["REGION"] } else { "us-central1" }
$minInst     = if ($config.ContainsKey("MIN_INSTANCES")) { $config["MIN_INSTANCES"] } else { "0" }
$maxInst     = if ($config.ContainsKey("MAX_INSTANCES")) { $config["MAX_INSTANCES"] } else { "2" }
$cpu         = if ($config.ContainsKey("CPU")) { $config["CPU"] } else { "1" }
$memory      = if ($config.ContainsKey("MEMORY")) { $config["MEMORY"] } else { "256Mi" }
$concurrency = if ($config.ContainsKey("CONCURRENCY")) { $config["CONCURRENCY"] } else { "80" }
$timeout     = if ($config.ContainsKey("TIMEOUT")) { $config["TIMEOUT"] } else { "300s" }

Write-Host "▶ 讀取部署規格 (cloudrun.env):" -ForegroundColor Green
Write-Host "  - 服務名稱: $serviceName"
Write-Host "  - 部署區域: $region"
Write-Host "  - 執行個體下限: $minInst"
Write-Host "  - 執行個體上限: $maxInst"
Write-Host "  - 處理器 (CPU): $cpu"
Write-Host "  - 記憶體 (RAM): $memory"
Write-Host "  - 併發量: $concurrency"
Write-Host "  - 逾時: $timeout"
Write-Host ""

$deployArgs = @(
  "run", "deploy", $serviceName,
  "--source", $scriptDir,
  "--region", $region,
  "--min-instances", $minInst,
  "--max-instances", $maxInst,
  "--cpu", $cpu,
  "--memory", $memory,
  "--concurrency", $concurrency,
  "--timeout", $timeout,
  "--allow-unauthenticated"
)

$cmdLine = "gcloud " + ($deployArgs -join " ")

if ($DryRun) {
  Write-Host "[DRY RUN] 預覽即將執行的指令:" -ForegroundColor Yellow
  Write-Host $cmdLine -ForegroundColor Yellow
  exit 0
}

Write-Host "▶ 正在執行 Cloud Run 部署..." -ForegroundColor Cyan
Write-Host "$cmdLine" -ForegroundColor Gray

& gcloud @deployArgs

if ($LASTEXITCODE -eq 0) {
  Write-Host "✔ Cloud Run 部署成功完成！" -ForegroundColor Green
} else {
  Write-Error "✖ Cloud Run 部署失敗，請檢查 gcloud 權限與連線狀態。"
}
