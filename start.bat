@echo off
title  Hotel Management System
color 0A
echo.
echo  ============================================
echo   HOTEL MANAGEMENT SYSTEM
echo   Starting servers...
echo  ============================================
echo.

:: Start Backend
echo [1/2] Starting Backend API (port 5000)...
start "HMS Backend" cmd /k "cd /d "%~dp0backend" && node server.js"

:: Wait a moment
timeout /t 3 /nobreak >nul

:: Start Frontend
echo [2/2] Starting Frontend (port 3000)...
start "HMS Frontend" cmd /k "cd /d "%~dp0" && npx serve . -p 3000"

:: Wait for frontend to start
timeout /t 4 /nobreak >nul

:: Open browser
echo.
echo  ============================================
echo   Opening browser...
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:5000/api
echo  ============================================
echo.
start "" "http://localhost:3000"

echo  Both servers are running!
echo  Close the server windows to stop.
pause
