$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "ConstChat - Stop All Services"

$PROJECT = $PSScriptRoot

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Red
Write-Host "    ConstChat - Tum Servisler Durduruluyor" -ForegroundColor Red
Write-Host "  ========================================" -ForegroundColor Red
Write-Host ""

Write-Host "[1/3] Electron kapatiliyor..." -ForegroundColor Yellow
Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "ConstChat" -Force -ErrorAction SilentlyContinue
Write-Host "  OK" -ForegroundColor Green

Write-Host "[2/3] Node servisleri kapatiliyor..." -ForegroundColor Yellow
# Kill processes on all service ports: Web(3000), API(4000), Gateway(4001), Media(4002)
foreach ($port in @(3000, 4000, 4001, 4002)) {
    $lines = netstat -ano 2>$null | Select-String ":$port\s.*LISTENING"
    foreach ($line in $lines) {
        if ($line -match '\s(\d+)\s*$') {
            $procId = [int]$Matches[1]
            if ($procId -gt 0) {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                Write-Host "    Port $port -> PID $procId durduruldu" -ForegroundColor Gray
            }
        }
    }
}
# Also kill any stray node/ts-node processes with ConstChat in their command line
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    try {
        $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)" -ErrorAction SilentlyContinue).CommandLine
        $cmd -and $cmd -match "constchat|ConstChat"
    } catch { $false }
} | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    Write-Host "    Node PID $($_.Id) durduruldu" -ForegroundColor Gray
}
Write-Host "  OK" -ForegroundColor Green

Write-Host "[3/3] Docker container'lari durduruluyor..." -ForegroundColor Yellow
$compose = Join-Path $PROJECT "infra\docker\docker-compose.yml"
& docker compose -f $compose down 2>$null
Write-Host "  OK" -ForegroundColor Green

Write-Host ""
Write-Host "  Tum servisler durduruldu." -ForegroundColor Green
Write-Host ""
Read-Host "Kapatmak icin Enter"
