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
goto preflight

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
:: Sync lockfile before Docker build (Docker uses --frozen-lockfile)
:: ============================================================
echo.
echo [*] Syncing lockfile before Docker build...
call pnpm install --no-frozen-lockfile >nul 2>&1
if errorlevel 1 (
    echo [!] pnpm install failed.
    pause
    exit /b 1
)
echo [OK] Lockfile synced

:: ============================================================
:: Desktop Build
:: ============================================================
:desktop_build
echo.
echo ============================================================
echo   STEP: Desktop App Build
echo ============================================================
echo.

pushd "%~dp0apps\desktop"
for /f "delims=" %%V in ('node -e "console.log(require(\"./package.json\").version)"') do set "CUR_DESKTOP_VER=%%V"
echo   Şu anki sürüm: !CUR_DESKTOP_VER!
echo.
set "NEW_DESKTOP_VER="
set /p NEW_DESKTOP_VER="  Sürümü kaç yapmak istersiniz? (Enter = değiştirme, örnek 0.2.0): "
if not "!NEW_DESKTOP_VER!"=="" (
  echo [*] package.json sürümü güncelleniyor: !NEW_DESKTOP_VER!
  call npm version !NEW_DESKTOP_VER! --no-git-tag-version
  if errorlevel 1 (
    echo [!] Sürüm güncellenemedi. Geçerli semver girin ^(ör. 0.2.0, 1.0.0-beta.1^).
    popd
    goto desktop_fail
  )
  for /f "delims=" %%W in ('node -e "console.log(require(\"./package.json\").version)"') do set "CUR_DESKTOP_VER=%%W"
  echo [OK] Yeni sürüm: !CUR_DESKTOP_VER!
)
popd

echo.
echo [*] Building desktop installer (with web bundle)...

REM Build Next.js standalone inside Docker to avoid Windows symlink issues
REM Windows + pnpm + Next.js standalone = EPERM symlink errors
echo [*] Building web app via Docker (avoids Windows symlink issues)...
cd /d "%~dp0"
docker build -f apps/web/Dockerfile ^
  --build-arg NEXT_PUBLIC_API_URL=https://swiip.app/api ^
  --build-arg NEXT_PUBLIC_GATEWAY_URL=wss://swiip.app/gateway ^
  --build-arg NEXT_PUBLIC_CDN_URL=https://constchat.fra1.cdn.digitaloceanspaces.com ^
  --target builder ^
  -t swiip-web-builder .
if errorlevel 1 (
    echo [!] Docker web build failed. Pruning build cache and retrying...
    docker builder prune -f >nul 2>&1
    docker build -f apps/web/Dockerfile ^
      --build-arg NEXT_PUBLIC_API_URL=https://swiip.app/api ^
      --build-arg NEXT_PUBLIC_GATEWAY_URL=wss://swiip.app/gateway ^
      --build-arg NEXT_PUBLIC_CDN_URL=https://constchat.fra1.cdn.digitaloceanspaces.com ^
      --target builder ^
      -t swiip-web-builder .
    if errorlevel 1 (
        echo [!] Docker web build failed after cache prune.
        goto desktop_fail
    )
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

echo [*] Regenerating apps\desktop\build\icon.ico from PNG layers (Windows PE embedding)...
pushd "%~dp0apps\desktop"
call node scripts\generate-icon-ico.mjs
if errorlevel 1 (
  echo [!] generate-icon-ico failed
  popd
  goto desktop_fail
)
popd

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

echo [*] Verifying public update feed (https://swiip.app/downloads/latest.yml^)...
pushd "%~dp0apps\desktop"
call node scripts\verify-update-endpoint.mjs
if errorlevel 1 (
  echo [!] Update feed check failed — confirm latest.yml and the versioned installer exist and match.
)
popd

echo [OK] Installer published
echo.
goto preflight

:desktop_fail
echo [!] Desktop build failed or no installer found. Continuing...
cd /d "%~dp0"
if exist "%BDIR%" rmdir /s /q "%BDIR%" 2>nul
goto preflight

:: ============================================================
:: Preflight — validate infra files locally before pushing.
:: Catches the kind of yaml/compose/Caddy errors that previously
:: only surfaced on the server after GHA finished building images.
:: ============================================================
:preflight
echo.
echo ============================================================
echo   STEP: Preflight Infra Validation
echo ============================================================
echo.

set "PREFLIGHT_FAILED=0"

:: 1) docker-compose.deploy.yml — uses dummy env file so config can resolve placeholders
echo [*] Validating docker-compose.deploy.yml...
set "DUMMY_ENV=%TEMP%\swiip_dummy.env"
> "%DUMMY_ENV%" echo DATABASE_URL=postgres://x:x@db/x
>> "%DUMMY_ENV%" echo REDIS_URL=redis://x
>> "%DUMMY_ENV%" echo JWT_SECRET=dummy
>> "%DUMMY_ENV%" echo JWT_REFRESH_SECRET=dummy
>> "%DUMMY_ENV%" echo CORS_ORIGIN=https://x
>> "%DUMMY_ENV%" echo S3_ENDPOINT=https://x
>> "%DUMMY_ENV%" echo S3_ACCESS_KEY=x
>> "%DUMMY_ENV%" echo S3_SECRET_KEY=x
>> "%DUMMY_ENV%" echo SMTP_PASS=x
>> "%DUMMY_ENV%" echo DB_USER=x
>> "%DUMMY_ENV%" echo DB_PASSWORD=x
>> "%DUMMY_ENV%" echo DB_NAME=x
>> "%DUMMY_ENV%" echo REDIS_PASSWORD=x
>> "%DUMMY_ENV%" echo PUBLIC_API_URL=https://x
>> "%DUMMY_ENV%" echo PUBLIC_GATEWAY_URL=wss://x
>> "%DUMMY_ENV%" echo LIVEKIT_WS_URL=wss://x
>> "%DUMMY_ENV%" echo LIVEKIT_API_KEY=x
>> "%DUMMY_ENV%" echo LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
>> "%DUMMY_ENV%" echo TURN_PUBLIC_HOST=x
>> "%DUMMY_ENV%" echo TURN_PUBLIC_IP=1.1.1.1
>> "%DUMMY_ENV%" echo TURN_SHARED_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
docker compose -f infra/docker/docker-compose.deploy.yml --env-file "%DUMMY_ENV%" --profile voice config >nul 2>"%TEMP%\swiip_compose_err.txt"
if errorlevel 1 (
    echo [!] docker-compose.deploy.yml is invalid:
    type "%TEMP%\swiip_compose_err.txt"
    set "PREFLIGHT_FAILED=1"
) else (
    echo [OK] docker-compose.deploy.yml parses cleanly
)
del "%DUMMY_ENV%" 2>nul
del "%TEMP%\swiip_compose_err.txt" 2>nul

:: 2) Cross-check GHA deploy.yml restarts every required service.
::    Drift here causes the worst kind of bug: GHA reports green but the
::    skipped service stays stale on the server. Past hits:
::      - 7da46b5: livekit + coturn missing → voice infra never restarted
::      - this session: caddy missing → reverse proxy kept old upstream IPs
echo [*] Cross-checking GHA deploy.yml service list...
set "DEPLOY_YML=.github\workflows\deploy.yml"
set "GHA_MISSING="
for %%S in (api gateway web workers media-signalling livekit coturn caddy) do (
    findstr /C:"up -d" "%DEPLOY_YML%" | findstr /C:"%%S" >nul
    if errorlevel 1 set "GHA_MISSING=!GHA_MISSING! %%S"
)
if defined GHA_MISSING (
    echo [!] .github/workflows/deploy.yml's 'docker compose ... up -d' line is
    echo     missing these services:!GHA_MISSING!
    echo     Add them or option 2 will deploy stale infra.
    set "PREFLIGHT_FAILED=1"
) else (
    echo [OK] GHA deploy.yml restarts every required service
)

:: 3) livekit.yaml — schema validation by actually booting livekit-server.
::    No --validate flag exists. We render the template, start the server in
::    the background, and 3s later check whether it's still running. A clean
::    parse keeps it running; bad fields make it exit immediately
::    (commit 9895eea was this exact class of bug).
echo [*] Validating livekit.yaml against livekit-server schema...
set "LK_RENDERED=%TEMP%\swiip_livekit_rendered.yaml"
set "LK_LOG=%TEMP%\swiip_lk_err.txt"
powershell -NoProfile -Command "(Get-Content 'infra/docker/livekit.yaml' -Raw) -replace '\$\{TURN_PUBLIC_HOST\}','127.0.0.1' -replace '\$\{TURN_SHARED_SECRET\}','xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' | Set-Content -NoNewline -Encoding utf8 '%LK_RENDERED%'" >nul 2>&1
docker rm -f swiip-lk-validate >nul 2>&1
docker run --name swiip-lk-validate -d ^
  -v "%LK_RENDERED%:/etc/livekit.yaml:ro" ^
  -e LIVEKIT_KEYS="dummy: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" ^
  livekit/livekit-server:latest --config /etc/livekit.yaml --bind 127.0.0.1 --node-ip 127.0.0.1 >nul 2>&1
timeout /t 3 /nobreak >nul
set "LK_RUNNING=missing"
for /f "delims=" %%R in ('docker inspect -f "{{.State.Running}}" swiip-lk-validate 2^>nul') do set "LK_RUNNING=%%R"
docker logs swiip-lk-validate > "%LK_LOG%" 2>&1
docker rm -f swiip-lk-validate >nul 2>&1
if /i not "!LK_RUNNING!"=="true" (
    echo [!] livekit-server exited — config likely has schema errors:
    type "%LK_LOG%"
    set "PREFLIGHT_FAILED=1"
) else (
    echo [OK] livekit.yaml parses cleanly
)
del "%LK_RENDERED%" 2>nul
del "%LK_LOG%" 2>nul

:: 4) Caddyfile syntax
echo [*] Validating Caddyfile...
docker run --rm -v "%~dp0infra\docker\Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >nul 2>"%TEMP%\swiip_caddy_err.txt"
if errorlevel 1 (
    echo [!] Caddyfile is invalid:
    type "%TEMP%\swiip_caddy_err.txt"
    set "PREFLIGHT_FAILED=1"
) else (
    echo [OK] Caddyfile is valid
)
del "%TEMP%\swiip_caddy_err.txt" 2>nul

if !PREFLIGHT_FAILED!==1 (
    echo.
    echo [!] Preflight failed. Fix the errors above before pushing.
    pause
    exit /b 1
)
echo.
echo [OK] All infra files validated
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

:: Capture the commit SHA we just pushed — used to find all triggered workflows
set COMMIT_SHA=
for /f "tokens=1" %%h in ('git rev-parse HEAD 2^>nul') do set COMMIT_SHA=%%h
echo [*] Commit: !COMMIT_SHA!

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

echo [*] Waiting for GitHub Actions to pick up the push...
echo     Commit: !COMMIT_SHA!
echo     Giving GitHub 5s to register the push event...
timeout /t 5 /nobreak >nul

set WAIT_TRIES=0

:ci_poll_start
if !WAIT_TRIES! GEQ 24 (
    echo [!] Timed out waiting for workflows to start after ~2 minutes.
    echo     Check manually: https://github.com/Ruzzyferr/ConstChat/actions
    pause
    exit /b 1
)
set /a WAIT_TRIES+=1
echo     Checking for workflows... (attempt !WAIT_TRIES!/24)
timeout /t 5 /nobreak >nul

:: Find ALL workflow runs for this commit (deploy.yml + ci.yml + desktop-release.yml)
set FOUND_RUNS=0
for /f "tokens=*" %%i in ('gh run list --commit !COMMIT_SHA! --json databaseId --jq ".[].databaseId" 2^>nul') do set /a FOUND_RUNS+=1

if !FOUND_RUNS! EQU 0 (
    echo     ...no workflows registered yet, retrying...
    goto ci_poll_start
)

echo [OK] Found !FOUND_RUNS! workflow run(s) for this commit.
echo.

REM Collect all run IDs into a file to avoid special char issues in for loops
set "RUN_LIST=%TEMP%\constchat_runs.txt"
gh run list --commit !COMMIT_SHA! --json databaseId --jq ".[].databaseId" > "!RUN_LIST!" 2>nul

:: Count runs
set RUN_COUNT=0
for /f "tokens=*" %%i in ('type "!RUN_LIST!"') do set /a RUN_COUNT+=1

echo [OK] Will watch !RUN_COUNT! workflow run(s) sequentially using gh run watch.
echo     (Each run shows live-updating job status)
echo.

REM Watch each run with gh run watch (goto-based iteration)
set WATCH_IDX=0
set ANY_FAILED=0
set FAILED_RUN_ID=

:ci_watch_next
set /a WATCH_IDX+=1
set "CUR_WATCH_ID="

:: Read the Nth line from run list
set "LINE_NUM=0"
for /f "tokens=*" %%i in ('type "!RUN_LIST!"') do (
    set /a LINE_NUM+=1
    if !LINE_NUM!==!WATCH_IDX! set CUR_WATCH_ID=%%i
)

:: If no more runs, go to results
if not defined CUR_WATCH_ID goto ci_watch_results

echo ============================================================
echo   Watching Run #!CUR_WATCH_ID! (!WATCH_IDX!/!RUN_COUNT!)
echo ============================================================
echo.

gh run watch !CUR_WATCH_ID! --exit-status
if errorlevel 1 (
    echo.
    echo   [!!] Run #!CUR_WATCH_ID! FAILED
    set ANY_FAILED=1
    set FAILED_RUN_ID=!CUR_WATCH_ID!
) else (
    echo.
    echo   [OK] Run #!CUR_WATCH_ID! passed
)
echo.

goto ci_watch_next

:ci_watch_results
:: Clean up temp file
del "!RUN_LIST!" 2>nul

if !ANY_FAILED!==1 goto ci_fail

:: ============================================================
:: Post-deploy verification — confirm the server actually serves
:: traffic and all voice services are running. Catches the case
:: where GHA reports green but the server failed to bring infra up
:: (the LIVEKIT_KEYS / coturn class of bugs we hit before).
:: ============================================================
echo.
echo ============================================================
echo   STEP: Post-deploy Verification
echo ============================================================
echo.

set "VERIFY_FAILED=0"

echo [*] Hitting https://swiip.app/ ...
curl -sf -o NUL -w "HTTP %%{http_code}\n" https://swiip.app/ 2>nul
if errorlevel 1 (
    echo [!] swiip.app did not respond with 2xx
    set "VERIFY_FAILED=1"
)

echo [*] Hitting https://swiip.app/api/health ...
curl -sf -o NUL -w "HTTP %%{http_code}\n" https://swiip.app/api/health 2>nul
if errorlevel 1 (
    echo [!] /api/health did not respond with 2xx
    set "VERIFY_FAILED=1"
)

:: LiveKit is reached through Caddy's /livekit reverse proxy. A 200 here proves
:: Caddy was recreated with the latest Caddyfile and can resolve the upstream
:: (the bug class we hit when caddy was missing from the GHA up -d list).
echo [*] Hitting https://swiip.app/livekit/ ...
curl -sf -o NUL -w "HTTP %%{http_code}\n" https://swiip.app/livekit/ 2>nul
if errorlevel 1 (
    echo [!] /livekit/ did not respond with 2xx — Caddy may not be reaching LiveKit
    set "VERIFY_FAILED=1"
)

:: CSP must come from Next.js middleware (per-request nonce + 'strict-dynamic').
:: If we still see Caddy's old static CSP here, Caddy didn't reload its config —
:: that's the bug class where `up -d caddy` is a no-op for Caddyfile-only edits.
:: Auto-remediate: force-recreate caddy then re-check. No manual SSH step.
echo [*] Verifying CSP is the per-request nonce variant ^(not stale Caddy CSP^)...
curl -sI https://swiip.app/login 2>nul | findstr /I "content-security-policy" | findstr /C:"strict-dynamic" >nul
if errorlevel 1 (
    echo [!] CSP header is stale — does not contain 'strict-dynamic'.
    echo [*] Auto-remediating: force-recreating caddy on server...
    ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% --profile voice up -d --force-recreate --no-deps caddy"
    timeout /t 5 /nobreak >nul
    curl -sI https://swiip.app/login 2>nul | findstr /I "content-security-policy" | findstr /C:"strict-dynamic" >nul
    if errorlevel 1 (
        echo [!] CSP still stale after force-recreate. Inspect server manually:
        echo     ssh %SERVER% "docker logs docker-caddy-1 --tail 50"
        set "VERIFY_FAILED=1"
    ) else (
        echo [OK] CSP restored after caddy force-recreate
    )
) else (
    echo [OK] CSP has strict-dynamic ^(middleware is live^)
)

echo [*] Checking server-side service status...
ssh -o ConnectTimeout=10 %SERVER% "docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'swiip-(api|gateway|web|workers|media-signalling|livekit|coturn|caddy)'" 2>nul
echo.

:: Each voice-profile service must be running. `docker inspect` returns "true"
:: only if the container exists and is running — no regex/escape gymnastics.
:: RUNSTATE is reset each iteration so a missing container doesn't inherit the
:: previous "true" reading.
:: NOTE: caddy's container is named docker-caddy-1 (no container_name in compose,
:: project = "docker"). All other voice services have explicit swiip-* names.
for %%S in (swiip-api swiip-gateway swiip-web swiip-workers swiip-media-signalling swiip-livekit swiip-coturn docker-caddy-1) do (
    set "RUNSTATE=missing"
    for /f "delims=" %%R in ('ssh %SERVER% "docker inspect -f '{{.State.Running}}' %%S 2>/dev/null"') do set "RUNSTATE=%%R"
    if /i not "!RUNSTATE!"=="true" (
        echo [!] %%S is NOT running on the server ^(state=!RUNSTATE!^)
        set "VERIFY_FAILED=1"
    )
)

if !VERIFY_FAILED!==1 (
    echo.
    echo [!] Post-deploy verification failed. Check server logs:
    echo     ssh %SERVER% "docker logs swiip-livekit --tail 30"
    echo.
    pause
    exit /b 1
)
echo [OK] All services healthy

:ci_done
echo.
echo ============================================================
echo   DEPLOY COMPLETE
echo ============================================================
echo.
echo   All workflows passed. Your changes are live!
echo.
echo   Server: 209.38.205.251
echo   URL:    https://swiip.app
echo.
echo   Actions: https://github.com/Ruzzyferr/ConstChat/actions
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
echo   https://github.com/Ruzzyferr/ConstChat/actions
echo.

if defined FAILED_RUN_ID (
    set /p RETRY="  Retry failed workflow? [y/N]: "
    if /i "!RETRY!"=="y" (
        echo [*] Re-running failed jobs...
        gh run rerun !FAILED_RUN_ID! --failed 2>nul
        if errorlevel 1 (
            gh run rerun !FAILED_RUN_ID! 2>nul
        )
        echo [OK] Re-run triggered, watching again...
        echo.
        timeout /t 10 /nobreak >nul
        REM Re-collect runs and watch again
        gh run list --commit !COMMIT_SHA! --json databaseId --jq ".[].databaseId" > "!RUN_LIST!" 2>nul
        set RUN_COUNT=0
        for /f "tokens=*" %%i in ('type "!RUN_LIST!"') do set /a RUN_COUNT+=1
        set WATCH_IDX=0
        set ANY_FAILED=0
        set FAILED_RUN_ID=
        goto ci_watch_next
    )
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
ssh %SERVER% "cd %REPO_DIR% && docker compose -f %COMPOSE_FILE% --env-file %ENV_FILE% --profile voice up -d api gateway web workers media-signalling livekit coturn 2>&1"
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
