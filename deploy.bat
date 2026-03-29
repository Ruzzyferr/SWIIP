@echo off
setlocal enabledelayedexpansion
title Swiip Deploy
chcp 65001 >nul 2>&1

set SERVER=root@209.38.205.251
set REPO_DIR=/opt/ConstChat
set COMPOSE_FILE=infra/docker/docker-compose.deploy.yml
set ENV_FILE=.env.production

cd /d "%~dp0"

echo.
echo   ========================================
echo     Swiip Deploy Script
echo   ========================================
echo.
echo   1^) Full deploy - git push + server rebuild
echo   2^) Full deploy + Desktop app build
echo   3^) Server only - skip git push, just rebuild
echo.
set /p CHOICE="  Select [1/2/3]: "

if "%CHOICE%"=="2" goto ensure_docker
goto git_step

:: ============================================================
:: Ensure Docker Desktop is running
:: ============================================================
:ensure_docker
docker info >nul 2>&1
if not errorlevel 1 goto desktop_build

echo.
echo [*] Docker Desktop is not running, starting it...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo [*] Waiting for Docker to be ready...
:docker_wait
timeout /t 3 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 goto docker_wait
echo [OK] Docker Desktop is ready


:: ============================================================
:: Desktop Build
:: ============================================================
:desktop_build
echo.
echo ============================================================
echo   STEP: Desktop App Build
echo ============================================================
echo.
echo [*] Building desktop installer (with web bundle)...

:: Build Next.js standalone inside Docker to avoid Windows symlink issues
:: (Windows + pnpm + Next.js standalone = EPERM symlink errors)
echo [*] Building web app via Docker (avoids Windows symlink issues)...
cd /d "%~dp0"
docker build -f apps/web/Dockerfile ^
  --build-arg NEXT_PUBLIC_API_URL=https://swiip.app/api ^
  --build-arg NEXT_PUBLIC_GATEWAY_URL=wss://swiip.app/gateway ^
  --build-arg NEXT_PUBLIC_CDN_URL=https://constchat.fra1.cdn.digitaloceanspaces.com ^
  --target builder ^
  -t swiip-web-builder .
if errorlevel 1 (
    echo [!] Docker web build failed.
    goto desktop_fail
)

:: Extract standalone output from Docker builder stage
echo [*] Extracting web bundle from Docker...
docker rm swiip-web-extract 2>nul
docker create --name swiip-web-extract swiip-web-builder
if exist "%~dp0apps\web\.next\standalone" rmdir /s /q "%~dp0apps\web\.next\standalone"
mkdir "%~dp0apps\web\.next\standalone" 2>nul
docker cp swiip-web-extract:/app/apps/web/.next/standalone/. "%~dp0apps\web\.next\standalone"
docker cp swiip-web-extract:/app/apps/web/.next/static/. "%~dp0apps\web\.next\static"
if not exist "%~dp0apps\web\public" mkdir "%~dp0apps\web\public"
docker cp swiip-web-extract:/app/apps/web/public/. "%~dp0apps\web\public"
docker rm swiip-web-extract
echo [OK] Web app built via Docker

set "BDIR=C:\tmp\swiip-build"
if exist "%BDIR%" rmdir /s /q "%BDIR%"
mkdir "%BDIR%"
xcopy /E /I /Q "%~dp0apps\desktop\src" "%BDIR%\src" >nul
xcopy /E /I /Q "%~dp0apps\desktop\build" "%BDIR%\build" >nul
copy /Y "%~dp0apps\desktop\package.json" "%BDIR%\package.json" >nul

:: Copy standalone output as web-bundle (preserves monorepo structure)
echo [*] Copying web bundle...
xcopy /E /I /Q "%~dp0apps\web\.next\standalone" "%BDIR%\web-bundle" >nul
xcopy /E /I /Q "%~dp0apps\web\.next\static" "%BDIR%\web-bundle\apps\web\.next\static" >nul
xcopy /E /I /Q "%~dp0apps\web\public" "%BDIR%\web-bundle\apps\web\public" >nul
echo [OK] Web bundle copied

cd /d "%BDIR%"

echo [*] Installing dependencies...
call npm install >nul 2>&1

echo [*] Running electron-builder...
call npx electron-builder --win nsis --publish never
if errorlevel 1 goto desktop_fail

set "INSTALLER="
for %%f in (dist\Swiip-Setup-*.exe) do set "INSTALLER=%%f"
if not defined INSTALLER goto desktop_fail

for %%f in (!INSTALLER!) do set "INSTALLER_NAME=%%~nxf"
echo [OK] Built: !INSTALLER_NAME!

echo [*] Uploading !INSTALLER_NAME! to server...
scp "dist\!INSTALLER_NAME!" %SERVER%:%REPO_DIR%/infra/docker/downloads/!INSTALLER_NAME!
if errorlevel 1 goto desktop_fail

echo [*] Updating latest alias on server...
ssh %SERVER% "cd %REPO_DIR%/infra/docker/downloads && cp -f '!INSTALLER_NAME!' Swiip-Setup-latest.exe"

for %%f in (dist\*.yml) do (
    scp "%%f" %SERVER%:%REPO_DIR%/infra/docker/downloads/ >nul 2>&1
)

cd /d "%~dp0"
rmdir /s /q "%BDIR%" 2>nul
echo [OK] Installer published
echo.
goto git_step

:desktop_fail
echo [!] Desktop build failed or no installer found. Continuing...
cd /d "%~dp0"
if exist "%BDIR%" rmdir /s /q "%BDIR%" 2>nul
goto git_step

:: ============================================================
:: Git Push
:: ============================================================
:git_step
cd /d "%~dp0"

if "%CHOICE%"=="3" goto deploy

echo.
echo ============================================================
echo   STEP: Git Push
echo ============================================================
echo.

git diff --quiet --exit-code 2>nul
if errorlevel 1 goto has_changes
goto do_push

:has_changes
echo [!] Uncommitted changes:
git status --short
echo.
set /p COMMIT_MSG="  Commit message [Enter to skip push]: "
if "!COMMIT_MSG!"=="" goto deploy
git add -A
git commit -m "!COMMIT_MSG!"

:do_push
echo [*] Pushing to origin/master...
git push origin master
if errorlevel 1 goto push_fail
echo [OK] Push successful
goto deploy

:push_fail
echo [!] Push failed. Check errors above.
pause
exit /b 1

:: ============================================================
:: Server Deploy
:: ============================================================
:deploy
echo.
echo ============================================================
echo   STEP: Server Deploy
echo ============================================================
echo.

echo [*] Pulling latest code on server...
ssh %SERVER% "cd %REPO_DIR% && git pull origin master"
if errorlevel 1 goto deploy_fail

echo.
echo [*] Logging into GHCR on server...
ssh %SERVER% "echo $GITHUB_TOKEN | docker login ghcr.io -u Ruzzyferr --password-stdin 2>/dev/null || echo 'GHCR login skipped (no token), will build locally'"

echo [*] Pulling pre-built images from GHCR...
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% pull api gateway web workers media-signalling 2>&1 || echo 'Pull failed, will build locally'"

echo [*] Running Prisma migrations...
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% run --rm api migrate 2>&1 || echo 'Migration skipped'"

echo.
echo [*] Starting services...
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% --profile voice up -d api gateway web workers media-signalling 2>&1"
if errorlevel 1 goto deploy_fail

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
ssh %SERVER% "docker image prune -f --filter until=24h > /dev/null 2>&1"

echo.
echo ============================================================
echo   DEPLOY COMPLETE
echo ============================================================
echo.
echo   Server: 209.38.205.251
echo   URL:    https://swiip.app
echo.
pause
exit /b 0

:deploy_fail
echo [!] Deploy failed! Check errors above.
pause
exit /b 1
