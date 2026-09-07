@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"
title HUI HERITAGE 本地启动器

echo [1/3] 启动本地 PostgreSQL...
call npm.cmd run db:start:local
if errorlevel 1 (
    echo.
    echo PostgreSQL 启动失败，请检查 PostgreSQL 安装路径或错误信息。
    pause
    exit /b 1
)

echo [2/3] 启动 HUI HERITAGE 开发服务器...
start "HUI HERITAGE Server" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev:postgres"

echo [3/3] 等待服务器就绪并打开浏览器...
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ready = $false; for ($i = 0; $i -lt 60; $i++) { try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3014/' -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { $ready = $true; break } } catch {}; Start-Sleep -Seconds 1 }; if ($ready) { Start-Process 'http://localhost:3014/' } else { Write-Host '服务器在 60 秒内未就绪，请查看 HUI HERITAGE Server 窗口。' -ForegroundColor Yellow; exit 1 }"

if errorlevel 1 pause
endlocal
