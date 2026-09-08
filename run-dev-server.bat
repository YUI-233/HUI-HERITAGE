@echo off
cd /d "%~dp0"
title HUI HERITAGE Development Server
npm.cmd run dev:postgres
pause
