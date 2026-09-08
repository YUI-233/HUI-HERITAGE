@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"
title HUI HERITAGE Local Launcher

echo [1/3] Starting local PostgreSQL...
call npm.cmd run db:start:local
if errorlevel 1 (
    echo.
    echo PostgreSQL failed to start. Check the PostgreSQL path and error output.
    pause
    exit /b 1
)

echo [2/3] Starting HUI HERITAGE development server...
start "HUI HERITAGE Server" "%~dp0run-dev-server.bat"

echo [3/3] Waiting for the server and opening the browser...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-local-browser.ps1"
if not errorlevel 1 start "" "http://localhost:3014/"

if errorlevel 1 pause
endlocal
