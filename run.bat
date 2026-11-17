@echo off
title MeritExam - FBISE NBF MCQ System
cd /d "%~dp0"

echo ============================================
echo   MeritExam - FBISE / NBF MCQ Test System
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is not installed on this computer.
    echo Please download and install Node.js 22 LTS from: https://nodejs.org/
    echo After installing Node.js, double-click run.bat again.
    echo.
    pause
    exit /b 1
)

if exist ".env" goto check_modules
if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
) else (
    echo GEMINI_API_KEY=MY_GEMINI_API_KEY> ".env"
)

echo [Setup] Enter your Gemini API Key to enable MCQ paper generation.
echo (Get a free key from: https://aistudio.google.com/apikey)
set "USER_GEMINI_KEY="
set /p "USER_GEMINI_KEY=Paste GEMINI_API_KEY (or press Enter to skip for now): "
if not "%USER_GEMINI_KEY%"=="" (
    powershell -NoProfile -Command "$k=$env:USER_GEMINI_KEY; (Get-Content '.env') -replace 'MY_GEMINI_API_KEY', $k | Set-Content '.env'"
    echo [OK] GEMINI_API_KEY saved in .env
) else (
    echo [NOTE] You can edit the .env file later to add your GEMINI_API_KEY.
)

:check_modules
if exist "node_modules" goto start_app
echo.
echo [1/2] Installing dependencies (first-time setup)...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed. Check your internet connection and try again.
    pause
    exit /b 1
)

:start_app
echo.
echo [2/2] Starting MeritExam at http://localhost:3000 ...
echo Keep this black window open while using the application.
echo.
start "" http://localhost:3000
call npm run dev
if errorlevel 1 (
    echo.
    echo [ERROR] Server stopped unexpectedly.
    pause
)
