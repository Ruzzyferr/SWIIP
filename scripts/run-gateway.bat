@echo off
title ConstChat Gateway [4001]
cd /d "%~dp0..\services\gateway"
pnpm dev
pause
