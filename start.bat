@echo off
echo Starting AI Automation Browser...
echo.

echo Installing dependencies...
call npm run install-all
if %errorlevel% neq 0 (
    echo Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Building application...
call npm run build
if %errorlevel% neq 0 (
    echo Failed to build application
    pause
    exit /b 1
)

echo.
echo Starting application...
call npm start

pause