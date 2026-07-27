@echo off
title ERP Manager - Initial Setup
cd /d "%~dp0"

echo [1/2] Installing all required packages...
call npm install

echo.
echo [2/2] Running security audit fix...
call npm audit fix

echo.
echo ====================================
echo  Setup Complete!
echo  You can now run 'run.bat' to start the application.
echo ====================================
echo.
pause
