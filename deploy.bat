@echo off
setlocal enabledelayedexpansion
title Swiip Deploy
chcp 65001 >nul 2>&1

:: ─── Config ─────────────────────────────────────────────────────────────────
set SERVER=root@209.38.205.251
set REPO_DIR=/opt/ConstChat
set COMPOSE_FILE=infra/docker/docker-compose.deploy.yml
set ENV_FILE=.env.production

:: ─── Step 1: Build Desktop App ──────────────────────────────────────────────
echo.
echo ============================================================
echo   STEP 1: Desktop App Build
echo ============================================================
echo.

cd /d "%~dp0"
echo [*] Building desktop installer...
cd apps\desktop

call npm run build
if errorlevel 1 (
    echo [!] Desktop build failed!
    pause
    exit /b 1
)

:: Find the built installer
set "INSTALLER="
for %%f in (dist\Swiip-Setup-*.exe) do set "INSTALLER=%%f"

if not defined INSTALLER (
    echo [!] No installer found in apps\desktop\dist\
    pause
    exit /b 1
)

echo [OK] Built: %INSTALLER%

:: Extract version from filename (Swiip-Setup-X.Y.Z.exe)
for %%f in (%INSTALLER%) do set "INSTALLER_NAME=%%~nxf"

cd /d "%~dp0"

:: ─── Step 2: Upload Installer to Server ─────────────────────────────────────
echo.
echo ============================================================
echo   STEP 2: Upload Desktop Installer
echo ============================================================
echo.

echo [*] Uploading %INSTALLER_NAME% to server...
scp "apps\desktop\%INSTALLER%" %SERVER%:%REPO_DIR%/infra/docker/downloads/%INSTALLER_NAME%
if errorlevel 1 (
    echo [!] Upload failed!
    pause
    exit /b 1
)
echo [OK] Installer uploaded

echo [*] Updating latest alias and generating manifest...
ssh %SERVER% "cd %REPO_DIR%/infra/docker/downloads && cp -f '%INSTALLER_NAME%' Swiip-Setup-latest.exe && sha256sum Swiip-Setup-latest.exe | awk '{print $1}' > Swiip-Setup-latest.exe.sha256 && echo Updated latest alias"

:: Generate latest.yml for electron-updater auto-update
for %%f in (apps\desktop\dist\*.yml) do (
    scp "%%f" %SERVER%:%REPO_DIR%/infra/docker/downloads/
)
echo [OK] Installer published

:: ─── Step 3: Git Push ───────────────────────────────────────────────────────
echo.
echo ============================================================
echo   STEP 3: Git Push
echo ============================================================
echo.

echo [*] Checking local git status...
for /f %%i in ('git status --porcelain 2^>nul') do (
    echo [!] Uncommitted changes detected:
    git status --short
    echo.
    set /p CONTINUE="Commit and push? (y/N): "
    if /i not "!CONTINUE!"=="y" (
        echo Skipping push...
        goto :deploy
    )
    echo [*] Committing all changes...
    git add -A
    git commit -m "chore: deploy update"
    goto :push
)

:push
echo [*] Pushing to origin/master...
git push origin master
if errorlevel 1 (
    echo [!] Push failed!
    pause
    exit /b 1
)
echo [OK] Push successful

:: ─── Step 4: Server Deploy ──────────────────────────────────────────────────
:deploy
echo.
echo ============================================================
echo   STEP 4: Server Deploy
echo ============================================================
echo.

echo [*] Pulling latest code on server...
ssh %SERVER% "cd %REPO_DIR% && git pull origin master"
if errorlevel 1 (
    echo [!] Git pull failed on server!
    pause
    exit /b 1
)

echo [*] Running Prisma migrations...
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% exec -T api npx prisma migrate deploy 2>&1 || echo 'Migration skipped (container not running yet)'"

echo [*] Rebuilding and deploying all services (this takes a few minutes)...
ssh -t %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% --profile voice up -d --build api gateway web media-signalling 2>&1"
if errorlevel 1 (
    echo [!] Docker build/deploy failed!
    pause
    exit /b 1
)

:: ─── Step 5: Health Checks ──────────────────────────────────────────────────
echo.
echo ============================================================
echo   STEP 5: Health Checks
echo ============================================================
echo.

echo [*] Waiting 30 seconds for services to start...
timeout /t 30 /nobreak >nul

set FAILED=0

echo [*] Checking API...
ssh %SERVER% "curl -sf http://localhost:4000/health > /dev/null 2>&1 && echo 'OK' || echo 'FAIL'"
echo [*] Checking Gateway...
ssh %SERVER% "curl -sf http://localhost:4001/health > /dev/null 2>&1 && echo 'OK' || echo 'FAIL'"
echo [*] Checking Web...
ssh %SERVER% "curl -sf http://localhost:3000 > /dev/null 2>&1 && echo 'OK' || echo 'FAIL'"

echo.
echo [*] Service status:
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% ps"

echo [*] Cleaning up old Docker images...
ssh %SERVER% "docker image prune -f --filter 'until=24h' > /dev/null 2>&1"

:: ─── Done ───────────────────────────────────────────────────────────────────
echo.
echo ============================================================
echo   DEPLOY COMPLETE
echo ============================================================
echo.
echo   Desktop installer: %INSTALLER_NAME%
echo   Server: 209.38.205.251
echo   URL: https://swiip.app
echo.
pause
