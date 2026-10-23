@echo off
title Injured Animal Detection Platform - Launcher
color 0A

echo ================================================================
echo    Injured Animal Detection and Rehabilitation Platform
echo ================================================================
echo.

echo [1/4] Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)
echo    Node.js detected.

echo [2/4] Ensuring port 5000 is clear...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo [3/4] Starting Backend API Server on http://localhost:5000...
cd /d "%~dp0backend"

:: Launch the server process
start "Injured Animal Detection Server" cmd /k "node server.js"

echo [4/4] Waiting for server initialization...
timeout /t 3 /nobreak >nul

echo.
echo Launching Application in default browser...
start http://localhost:5000/index.html

echo.
echo ================================================================
echo    SUCCESS! Application is now RUNNING.
echo ================================================================
echo    - Home Page:         http://localhost:5000/index.html
echo    - Automatic Module:  http://localhost:5000/automatic-module/automatic_module.html
echo    - Manual Report:     http://localhost:5000/manual-report/manual_report.html
echo    - Server Health:     http://localhost:5000/api/detection/status
echo ================================================================
echo    Keep the "Injured Animal Detection Server" window open.
echo    To stop the server, simply close that window.
echo ================================================================
echo.
pause
