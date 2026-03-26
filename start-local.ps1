$ErrorActionPreference = "Continue"
$Host.UI.RawUI.WindowTitle = "Swiip - Local Dev Launcher"

$PROJECT = $PSScriptRoot
$SCRIPTS = Join-Path $PROJECT "scripts"

Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "    Swiip Local Development Launcher  " -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Docker ---
Write-Host "[1/7] Docker kontrol ediliyor..." -ForegroundColor Yellow
$dockerOk = $false
try { docker info 2>$null | Out-Null; $dockerOk = $LASTEXITCODE -eq 0 } catch {}
if (-not $dockerOk) {
    Write-Host "  Docker Desktop baslatiliyor..." -ForegroundColor Gray
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    while ($true) {
        Start-Sleep -Seconds 3
        try { docker info 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { break } } catch {}
        Write-Host "  Bekleniyor..." -ForegroundColor Gray
    }
}
Write-Host "  Docker OK" -ForegroundColor Green
Write-Host ""

# --- Step 2: Infrastructure ---
Write-Host "[2/7] Altyapi baslatiliyor (Postgres, Redis, NATS, MinIO, Meilisearch, LiveKit)..." -ForegroundColor Yellow
$compose = Join-Path $PROJECT "infra\docker\docker-compose.yml"
& docker compose -f $compose up -d postgres redis nats minio minio-init meilisearch livekit 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Docker Compose basarisiz!" -ForegroundColor Red
    Read-Host "Devam etmek icin Enter"
    exit 1
}
Write-Host "  Altyapi OK" -ForegroundColor Green
Write-Host ""

# --- Step 3: Wait for PostgreSQL ---
Write-Host "[3/7] PostgreSQL bekleniyor..." -ForegroundColor Yellow
while ($true) {
    & docker exec swiip-postgres pg_isready -U swiip -d swiip 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep -Seconds 2
}
Write-Host "  PostgreSQL OK" -ForegroundColor Green
Write-Host ""

# --- Step 4: Dependencies & Build ---
Write-Host "[4/7] Bagimliliklar ve protokol paketi hazirlaniyor..." -ForegroundColor Yellow
Push-Location $PROJECT
& pnpm install --frozen-lockfile 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  pnpm install (lockfile ile) basarisiz, tekrar deneniyor..." -ForegroundColor Gray
    & pnpm install 2>$null | Out-Null
}
# Build protocol package (shared types used by all services)
& pnpm --filter @constchat/protocol run build 2>$null | Out-Null
Pop-Location
Write-Host "  Bagimliliklar OK" -ForegroundColor Green
Write-Host ""

# --- Step 5: Prisma ---
Write-Host "[5/7] Veritabani hazirlaniyor..." -ForegroundColor Yellow
Push-Location $PROJECT
& pnpm --filter @constchat/api exec prisma generate 2>$null | Out-Null
& pnpm --filter @constchat/api exec prisma db push --skip-generate 2>$null | Out-Null
Pop-Location
Write-Host "  Veritabani OK" -ForegroundColor Green
Write-Host ""

# --- Step 6: Start services ---
Write-Host "[6/7] Servisler baslatiliyor..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  API            http://localhost:4000" -ForegroundColor White
Write-Host "  Gateway        ws://localhost:4001" -ForegroundColor White
Write-Host "  Media Signal.  http://localhost:4002" -ForegroundColor White
Write-Host "  Web            http://localhost:3000" -ForegroundColor White
Write-Host "  LiveKit        ws://localhost:7880" -ForegroundColor DarkGray
Write-Host ""

Start-Process -FilePath (Join-Path $SCRIPTS "run-api.bat")
Start-Process -FilePath (Join-Path $SCRIPTS "run-gateway.bat")
Start-Process -FilePath (Join-Path $SCRIPTS "run-media.bat")

Start-Sleep -Seconds 5

Start-Process -FilePath (Join-Path $SCRIPTS "run-web.bat")

# --- Step 7: Wait for web ---
Write-Host "[7/7] Web sunucusu bekleniyor..." -ForegroundColor Yellow
$attempts = 0
while ($true) {
    Start-Sleep -Seconds 3
    $attempts++
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        break
    } catch {}
    if ($attempts -ge 40) {
        Write-Host "  Web sunucusu 2 dakika icerisinde baslamadi!" -ForegroundColor Red
        break
    }
}
Write-Host "  Web OK" -ForegroundColor Green
Write-Host ""

# Launch Electron
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "    Tum servisler hazir! Uygulama aciliyor" -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""

$deskDir = Join-Path $PROJECT "apps\desktop"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx electron ." -WorkingDirectory $deskDir

Write-Host ""
Write-Host "  Servisler calisiyor." -ForegroundColor White
Write-Host "  Durdurmak icin: stop.bat calistirin." -ForegroundColor Gray
Write-Host ""
Write-Host "  ----------------------------------------" -ForegroundColor DarkGray
Write-Host "  API:      http://localhost:4000" -ForegroundColor White
Write-Host "  Web:      http://localhost:3000" -ForegroundColor White
Write-Host "  Gateway:  ws://localhost:4001" -ForegroundColor White
Write-Host "  Media:    http://localhost:4002" -ForegroundColor White
Write-Host "  LiveKit:  ws://localhost:7880" -ForegroundColor White
Write-Host "  MinIO:    http://localhost:9001" -ForegroundColor White
Write-Host "  DB:       localhost:5432/swiip" -ForegroundColor White
Write-Host "  ----------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Read-Host "Kapatmak icin Enter"
