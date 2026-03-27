@echo off
setlocal enabledelayedexpansion
title Swiip Deploy
chcp 65001 >nul 2>&1

:: ─── Config ─────────────────────────────────────────────────────────────────
set SERVER=root@209.38.205.251
set REPO_DIR=/opt/ConstChat
set COMPOSE_FILE=infra/docker/docker-compose.deploy.yml
set ENV_FILE=.env.production

cd /d "%~dp0"

:: ─── Ask what to do ─────────────────────────────────────────────────────────
echo.
echo   ========================================
echo     Swiip Deploy Script
echo   ========================================
echo.
echo   1) Full deploy (git push + server rebuild)
echo   2) Full deploy + Desktop app build
echo   3) Server only (skip git push, just rebuild)
echo.
set /p CHOICE="  Select (1/2/3): "

if "%CHOICE%"=="2" goto :desktop_build
goto :git_step

:: ─── Desktop Build (optional) ───────────────────────────────────────────────
:desktop_build
echo.
echo ============================================================
echo   STEP: Desktop App Build
echo ============================================================
echo.

echo [*] Building desktop installer...
cd /d "%~dp0apps\desktop"

if not exist "node_modules" (
    echo [*] Installing dependencies...
    call npm install
)

call npm run build
if errorlevel 1 (
    echo [!] Desktop build failed. Continuing without installer update...
    cd /d "%~dp0"
    goto :git_step
)

:: Find the built installer
set "INSTALLER="
for %%f in (dist\Swiip-Setup-*.exe) do set "INSTALLER=%%f"

if not defined INSTALLER (
    echo [!] No installer found. Continuing...
    cd /d "%~dp0"
    goto :git_step
)

for %%f in (!INSTALLER!) do set "INSTALLER_NAME=%%~nxf"
echo [OK] Built: !INSTALLER_NAME!

cd /d "%~dp0"

echo [*] Uploading !INSTALLER_NAME! to server...
scp "apps\desktop\!INSTALLER!" %SERVER%:%REPO_DIR%/infra/docker/downloads/!INSTALLER_NAME!
if errorlevel 1 (
    echo [!] Upload failed. Continuing...
    goto :git_step
)

echo [*] Updating latest alias...
ssh %SERVER% "cd %REPO_DIR%/infra/docker/downloads && cp -f '!INSTALLER_NAME!' Swiip-Setup-latest.exe && sha256sum Swiip-Setup-latest.exe | awk '{print $1}' > Swiip-Setup-latest.exe.sha256"

:: Upload latest.yml for electron-updater
for %%f in (apps\desktop\dist\*.yml) do (
    scp "%%f" %SERVER%:%REPO_DIR%/infra/docker/downloads/ >nul 2>&1
)
echo [OK] Installer published
echo.

:: ─── Git Push ───────────────────────────────────────────────────────────────
:git_step
cd /d "%~dp0"

if "%CHOICE%"=="3" goto :deploy

echo.
echo ============================================================
echo   STEP: Git Push
echo ============================================================
echo.

:: Check for uncommitted changes
git diff --quiet --exit-code 2>nul
if errorlevel 1 (
    echo [!] Uncommitted changes:
    git status --short
    echo.
    set /p COMMIT_MSG="  Commit message (or press Enter to skip push): "
    if "!COMMIT_MSG!"=="" goto :deploy
    git add -A
    git commit -m "!COMMIT_MSG!"
)

echo [*] Pushing to origin/master...
git push origin master
if errorlevel 1 (
    echo [!] Push failed. Check errors above.
    echo.
    pause
    exit /b 1
)
echo [OK] Push successful

:: ─── Server Deploy ──────────────────────────────────────────────────────────
:deploy
echo.
echo ============================================================
echo   STEP: Server Deploy
echo ============================================================
echo.

echo [*] Pulling latest code on server...
ssh %SERVER% "cd %REPO_DIR% && git pull origin master"
if errorlevel 1 (
    echo [!] Git pull failed!
    pause
    exit /b 1
)

echo [*] Running Prisma migrations...
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% exec -T api npx prisma migrate deploy 2>&1 || echo 'Skipped (container rebuilding)'"

echo.
echo [*] Rebuilding services (this takes a few minutes)...
ssh -t %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% --profile voice up -d --build api gateway web media-signalling 2>&1"
if errorlevel 1 (
    echo [!] Docker build failed!
    pause
    exit /b 1
)

:: ─── Health Checks ──────────────────────────────────────────────────────────
echo.
echo ============================================================
echo   STEP: Health Checks
echo ============================================================
echo.

echo [*] Waiting 30s for services to start...
timeout /t 30 /nobreak >nul

ssh %SERVER% "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo.
echo [*] Cleaning up old images...
ssh %SERVER% "docker image prune -f --filter 'until=24h' > /dev/null 2>&1"

:: ─── Done ───────────────────────────────────────────────────────────────────
echo.
echo ============================================================
echo   DEPLOY COMPLETE
echo ============================================================
echo.
echo   Server: 209.38.205.251
echo   URL:    https://swiip.app
echo.
pause
