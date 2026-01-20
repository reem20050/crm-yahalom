@echo off
echo Starting Backend Server...
echo.

echo Step 1: Killing any process on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Killing process %%a
    taskkill /F /PID %%a >nul 2>&1
)
echo.

echo Step 2: Setting environment variables...
set GOOGLE_CLIENT_ID=833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com
set SECRET_KEY=some_random_secret

echo Environment variables set:
echo GOOGLE_CLIENT_ID=%GOOGLE_CLIENT_ID%
echo SECRET_KEY=%SECRET_KEY%
echo.

echo Step 3: Activating virtual environment...
call venv\Scripts\activate.bat

echo Step 4: Starting server...
python -m uvicorn main:app --host 0.0.0.0 --port 8000

pause
