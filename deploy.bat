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
echo   1^) Full deploy - git push + CI/CD
echo   2^) Full deploy + Desktop app build
echo   3^) Redeploy server (pull latest images)
echo.
set /p CHOICE="  Select [1/2/3]: "

if "%CHOICE%"=="2" goto ensure_docker
if "%CHOICE%"=="3" goto redeploy
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

echo.
echo ============================================================
echo   STEP: Update Lockfile
echo ============================================================
echo.
echo [*] Running pnpm install to sync lockfile...
call pnpm install --no-frozen-lockfile >nul 2>&1
if errorlevel 1 (
    echo [!] pnpm install failed. Check errors above.
    pause
    exit /b 1
)
echo [OK] Lockfile up to date

echo.
echo ============================================================
echo   STEP: Git Push
echo ============================================================
echo.

:: Stage everything first so we catch both modified AND untracked files
git add -A

:: Check if there is anything staged to commit
git diff --cached --quiet --exit-code 2>nul
if errorlevel 1 goto has_changes
echo [*] No changes to commit — pushing existing commits...
goto do_push

:has_changes
echo [!] Staged changes:
git --no-pager diff --cached --stat
echo.
set /p COMMIT_MSG="  Commit message [Enter for auto-message]: "
if "!COMMIT_MSG!"=="" (
    set "COMMIT_MSG=deploy: update"
)
git --no-pager commit -m "!COMMIT_MSG!"
if errorlevel 1 (
    echo [!] Commit failed. Check errors above.
    pause
    exit /b 1
)
echo [OK] Committed: !COMMIT_MSG!

:do_push
echo [*] Pushing to origin/master...
git --no-pager push origin master 2>&1
if errorlevel 1 goto push_fail

:: Check if push actually sent new commits or was already up-to-date
git --no-pager log origin/master..HEAD --oneline 2>nul | findstr /r "." >nul 2>&1
if not errorlevel 1 (
    echo [!] Push succeeded but local commits still ahead — unexpected state.
    echo     Check your remote manually.
    pause
    exit /b 1
)
echo [OK] Push successful
goto wait_ci

:push_fail
echo [!] Push failed. Check errors above.
pause
exit /b 1

:: ============================================================
:: Wait for GitHub Actions CI/CD
:: ============================================================
:wait_ci
echo.
echo ============================================================
echo   STEP: CI/CD Pipeline (GitHub Actions)
echo ============================================================
echo.

:: Give GitHub a moment to register the push event
echo [*] Waiting for GitHub Actions to pick up the push...
set FOUND_RUN=0
set WAIT_TRIES=0

:ci_poll_start
if !WAIT_TRIES! GEQ 12 (
    echo [!] Timed out waiting for workflow to start after 60s.
    echo     Check manually: https://github.com/Ruzzyferr/ConstChat/actions
    pause
    exit /b 1
)
set /a WAIT_TRIES+=1
timeout /t 5 /nobreak >nul

:: Get the latest "Build & Deploy" run
set RUN_ID=
for /f "tokens=1" %%i in ('gh run list --workflow deploy.yml --limit 1 --json databaseId --jq ".[0].databaseId" 2^>nul') do set RUN_ID=%%i

if not defined RUN_ID (
    echo     ...no workflow found yet (attempt !WAIT_TRIES!/12)
    goto ci_poll_start
)

:: Check that this run was triggered recently (within last 2 minutes)
set RUN_STATUS=
for /f "tokens=*" %%s in ('gh run view !RUN_ID! --json status --jq ".status" 2^>nul') do set RUN_STATUS=%%s

if "!RUN_STATUS!"=="completed" (
    :: If the latest run is already completed, it might be from a previous push
    :: Wait a bit more for the new one to appear
    if !WAIT_TRIES! LSS 6 (
        echo     ...latest run already completed, waiting for new run (attempt !WAIT_TRIES!/12)
        goto ci_poll_start
    )
)

echo [OK] Found workflow run #!RUN_ID! (status: !RUN_STATUS!)
echo     https://github.com/Ruzzyferr/ConstChat/actions/runs/!RUN_ID!
echo.

:: ── Watch individual build jobs ──────────────────────────────
echo ============================================================
echo   Monitoring Build Jobs
echo ============================================================
echo.

:ci_watch_loop
set ALL_DONE=1
set ANY_FAILED=0
set STATUS_LINE=

:: Get all jobs and their statuses
for /f "tokens=1,2,3 delims=	" %%a in ('gh run view !RUN_ID! --json jobs --jq ".jobs[] | [.name, .status, .conclusion] | @tsv" 2^>nul') do (
    set "JOB_NAME=%%a"
    set "JOB_STATUS=%%b"
    set "JOB_CONCLUSION=%%c"

    if "!JOB_STATUS!"=="completed" (
        if "!JOB_CONCLUSION!"=="success" (
            echo     [OK] !JOB_NAME!
        ) else if "!JOB_CONCLUSION!"=="failure" (
            echo     [!!] !JOB_NAME! — FAILED
            set ANY_FAILED=1
        ) else if "!JOB_CONCLUSION!"=="cancelled" (
            echo     [--] !JOB_NAME! — cancelled
        ) else (
            echo     [??] !JOB_NAME! — !JOB_CONCLUSION!
        )
    ) else if "!JOB_STATUS!"=="in_progress" (
        echo     [..] !JOB_NAME! — running...
        set ALL_DONE=0
    ) else if "!JOB_STATUS!"=="queued" (
        echo     [  ] !JOB_NAME! — queued
        set ALL_DONE=0
    ) else (
        echo     [  ] !JOB_NAME! — !JOB_STATUS!
        set ALL_DONE=0
    )
)

if !ANY_FAILED!==1 goto ci_fail

if !ALL_DONE!==1 goto ci_done

echo.
echo     Refreshing in 10s...
echo.
timeout /t 10 /nobreak >nul
goto ci_watch_loop

:ci_done
:: Final check — get overall run conclusion
set RUN_CONCLUSION=
for /f "tokens=*" %%s in ('gh run view !RUN_ID! --json conclusion --jq ".conclusion" 2^>nul') do set RUN_CONCLUSION=%%s

if "!RUN_CONCLUSION!"=="failure" goto ci_fail

echo.
echo ============================================================
echo   DEPLOY COMPLETE
echo ============================================================
echo.
echo   All jobs passed. Your changes are live!
echo.
echo   Server: 209.38.205.251
echo   URL:    https://swiip.app
echo.
echo   Run:    https://github.com/Ruzzyferr/ConstChat/actions/runs/!RUN_ID!
echo.
pause
exit /b 0

:ci_fail
echo.
echo ============================================================
echo   DEPLOY FAILED
echo ============================================================
echo.
echo   One or more jobs failed. Check the logs:
echo   https://github.com/Ruzzyferr/ConstChat/actions/runs/!RUN_ID!
echo.

:: Show which jobs failed
echo   Failed jobs:
for /f "tokens=1,2,3 delims=	" %%a in ('gh run view !RUN_ID! --json jobs --jq ".jobs[] | select(.conclusion==\"failure\") | [.name, .status, .conclusion] | @tsv" 2^>nul') do (
    echo     - %%a
)
echo.

set /p RETRY="  Retry deploy? [y/N]: "
if /i "!RETRY!"=="y" (
    echo [*] Re-running failed jobs...
    gh run rerun !RUN_ID! --failed 2>nul
    if errorlevel 1 (
        echo [*] Rerun command failed, triggering full re-run...
        gh run rerun !RUN_ID! 2>nul
    )
    echo [OK] Re-run triggered, watching again...
    echo.
    timeout /t 5 /nobreak >nul
    goto ci_watch_loop
)
pause
exit /b 1

:: ============================================================
:: Redeploy (pull latest GHCR images + restart)
:: ============================================================
:redeploy
echo.
echo ============================================================
echo   STEP: Redeploy Server
echo ============================================================
echo.

echo [*] Connecting to server...
ssh -o ConnectTimeout=10 %SERVER% "echo ok" >nul 2>&1
if errorlevel 1 (
    echo [!] Cannot connect to server %SERVER%
    echo     Check your SSH key and network connection.
    pause
    exit /b 1
)
echo [OK] Server connection established

echo [*] Logging into GHCR on server...
ssh %SERVER% "echo $GITHUB_TOKEN | docker login ghcr.io -u Ruzzyferr --password-stdin 2>/dev/null || echo 'GHCR login failed — set GITHUB_TOKEN on server'"

echo [*] Pulling latest code...
ssh %SERVER% "cd %REPO_DIR% && git checkout -- . && git pull origin master 2>&1"
if errorlevel 1 (
    echo [!] Git pull failed on server.
    pause
    exit /b 1
)
echo [OK] Code updated

echo [*] Pulling latest images from GHCR...
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% pull api gateway web workers media-signalling 2>&1"
if errorlevel 1 goto deploy_fail
echo [OK] Images pulled

echo [*] Running Prisma migrations...
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% run --rm api migrate 2>&1 || echo 'Migration skipped'"
echo [OK] Migrations done

echo.
echo [*] Restarting services...
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% --profile voice up -d api gateway web workers media-signalling 2>&1"
if errorlevel 1 goto deploy_fail
echo [OK] Services restarted

echo.
echo [*] Waiting 15s for services to initialize...
timeout /t 15 /nobreak >nul

echo.
echo   Service Status:
echo   ─────────────────────────────────────────────
ssh %SERVER% "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'" 2>nul
echo.

:: Health check
echo [*] Running health check...
set HEALTH_OK=1
ssh %SERVER% "curl -sf -o /dev/null -w '%%{http_code}' http://localhost:3000/ 2>/dev/null || echo 'FAIL'" > "%TEMP%\swiip_health.txt" 2>nul
set /p HEALTH_RESULT=<"%TEMP%\swiip_health.txt"
del "%TEMP%\swiip_health.txt" 2>nul

if "!HEALTH_RESULT!"=="FAIL" (
    echo [!] Web service health check FAILED
    echo     Services may still be starting. Check manually:
    echo     ssh %SERVER% "docker logs constchat-web-1 --tail 20"
    set HEALTH_OK=0
) else (
    echo [OK] Web service responding (HTTP !HEALTH_RESULT!)
)

echo.
echo [*] Cleaning up old images...
ssh %SERVER% "docker image prune -f --filter until=24h > /dev/null 2>&1"

echo.
echo ============================================================
if !HEALTH_OK!==1 (
    echo   REDEPLOY COMPLETE — All services healthy
) else (
    echo   REDEPLOY COMPLETE — Some services may need attention
)
echo ============================================================
echo.
echo   Server: 209.38.205.251
echo   URL:    https://swiip.app
echo.
pause
exit /b 0

:deploy_fail
echo [!] Deploy failed! Check errors above.
echo.
echo   Checking current service status...
ssh %SERVER% "docker ps --format 'table {{.Names}}\t{{.Status}}'" 2>nul
echo.
pause
exit /b 1
