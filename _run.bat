@echo off
title ERP Manager - Application Runner
cd /d "%~dp0"

echo =================================================================
echo  Starting ERP Manager Application...
echo  Two new terminal windows will open for the app and AI services.
echo  Please keep both windows running.
echo =================================================================

REM Start the Next.js development server in a new window
echo [1/3] Starting Next.js App Server...
start "Next.js Server" cmd /k "npm run dev"

REM Start the Genkit AI server in a new window
echo [2/3] Starting Genkit AI Server...
start "Genkit AI Server" cmd /k "npm run genkit:watch"

REM Wait for a few seconds to give the servers time to start up
echo [3/3] Opening application in browser...
timeout /t 10 /nobreak >nul

REM Open the default browser to the localhost address
start http://localhost:3000

echo.
echo Application is running. You can close this window.
