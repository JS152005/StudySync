@echo off
setlocal enabledelayedexpansion
title StudySync Runner
color 0B

echo ===================================================
echo           STUDYSYNC APPLICATION RUNNER
echo    Engineering ^& Medical Student Learning Platform
echo ===================================================
echo.

:: 1. Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in your PATH.
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

:: 2. Check npm installation
where npm >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] npm is not installed or not in your PATH.
    echo.
    pause
    exit /b 1
)

:: 3. Verify root dependencies
if not exist "node_modules\" (
    echo [SETUP] Installing root server dependencies...
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Failed to install root dependencies.
        pause
        exit /b 1
    )
)

:: 4. Verify client dependencies
if not exist "client\node_modules\" (
    echo [SETUP] Installing client frontend dependencies...
    cd client
    call npm install
    cd ..
    if %errorlevel% neq 0 (
        color 0C
        echo [ERROR] Failed to install client dependencies.
        pause
        exit /b 1
    )
)

:: Check command-line arguments
if /i "%1"=="1" goto dev_mode
if /i "%1"=="dev" goto dev_mode
if /i "%1"=="2" goto prod_mode
if /i "%1"=="prod" goto prod_mode
if /i "%1"=="3" goto test_mode
if /i "%1"=="test" goto test_mode
if /i "%1"=="4" goto build_mode
if /i "%1"=="build" goto build_mode

echo Select launch mode:
echo   [1] Development Mode (Live Reload: Backend on 5000 + Vite Client on 3000)
echo   [2] Production Mode  (Build client + Unified Server on Port 5000)
echo   [3] Run Test Suite   (Vitest 52 Integration ^& Core Tests)
echo   [4] Build Client Only
echo.

choice /C 1234 /T 5 /D 1 /M "Enter option [1-4] (auto-starts Option 1 in 5s): "
set CHOICE_VAL=%errorlevel%

if %CHOICE_VAL% equ 1 goto dev_mode
if %CHOICE_VAL% equ 2 goto prod_mode
if %CHOICE_VAL% equ 3 goto test_mode
if %CHOICE_VAL% equ 4 goto build_mode

:dev_mode
echo.
echo ===================================================
echo   Starting StudySync in Development Mode...
echo   - Backend Server: http://localhost:5000
echo   - Frontend Client: http://localhost:3000
echo ===================================================
echo.
start "StudySync Backend (Port 5000)" cmd /k "title StudySync Backend && npm run dev"
ping 127.0.0.1 -n 3 >nul
start "StudySync Frontend (Port 3000)" cmd /k "title StudySync Frontend && cd client && npm run dev"
ping 127.0.0.1 -n 4 >nul
echo Opening StudySync in your default browser...
start http://localhost:3000
echo.
echo Both servers are running in separate terminal windows.
echo To stop StudySync, simply close those terminal windows.
echo.
pause
exit /b 0

:prod_mode
echo.
echo ===================================================
echo   Building and Starting StudySync Production Mode...
echo ===================================================
echo.
echo Step 1/2: Compiling client bundle...
call npm run build:client
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Client build failed.
    pause
    exit /b 1
)
echo.
echo Step 2/2: Starting unified server on port 5000...
ping 127.0.0.1 -n 3 >nul
start http://localhost:5000
call npm start
exit /b 0

:test_mode
echo.
echo ===================================================
echo   Running StudySync Vitest Suite (52 Tests)...
echo ===================================================
echo.
call npm test
echo.
pause
exit /b 0

:build_mode
echo.
echo ===================================================
echo   Building StudySync Client...
echo ===================================================
echo.
call npm run build:client
echo.
pause
exit /b 0
