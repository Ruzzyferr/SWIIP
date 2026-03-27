@echo off
setlocal enabledelayedexpansion
title ConstChat Deploy

:: ─── Config ─────────────────────────────────────────────────────────────────
set SERVER=root@209.38.205.251
set REPO_DIR=/opt/ConstChat
set DEPLOY_SCRIPT=scripts/deploy.sh

:: ─── Parse args ─────────────────────────────────────────────────────────────
set ARGS=%*
if "%ARGS%"=="" set ARGS=

:: ─── Ensure local changes are pushed ────────────────────────────────────────
echo.
echo [*] Checking local git status...
git status --porcelain > nul 2>&1
for /f %%i in ('git status --porcelain') do (
    echo [!] You have uncommitted local changes:
    git status --short
    echo.
    set /p CONTINUE="Continue anyway? (y/N): "
    if /i not "!CONTINUE!"=="y" (
        echo Aborted.
        exit /b 1
    )
    goto :push
)

:push
echo [*] Pushing to origin/master...
git push origin master
if errorlevel 1 (
    echo [!] Push failed. Fix issues and try again.
    exit /b 1
)
echo [OK] Push successful
echo.

:: ─── Run deploy on server ───────────────────────────────────────────────────
echo [*] Deploying on server...
echo ─────────────────────────────────────────────────────
ssh -t %SERVER% "cd %REPO_DIR% && bash %DEPLOY_SCRIPT% %ARGS%"
echo ─────────────────────────────────────────────────────
echo.

if errorlevel 1 (
    echo [FAIL] Deploy failed! Check logs above.
    pause
    exit /b 1
)

echo [OK] Deploy complete!
echo.
pause
