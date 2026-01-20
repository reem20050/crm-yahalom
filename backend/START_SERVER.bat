@echo off
cd /d %~dp0
echo ========================================
echo Starting Backend Server
echo ========================================
echo.

echo Step 1: Killing any process on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Killing process %%a on port 8000
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo.

set GOOGLE_CLIENT_ID=833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com
set SECRET_KEY=some_random_secret

echo Step 2: Environment variables:
echo GOOGLE_CLIENT_ID=%GOOGLE_CLIENT_ID%
echo SECRET_KEY=%SECRET_KEY%
echo.

echo Step 3: Activating virtual environment...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment!
    pause
    exit /b 1
)
echo Virtual environment activated.
echo.

echo Step 4: Starting uvicorn server...
echo ========================================
echo Server will be available at: http://localhost:8000
echo Press CTRL+C to stop the server
echo ========================================
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8000

if errorlevel 1 (
    echo.
    echo ERROR: Server failed to start!
    pause
)
