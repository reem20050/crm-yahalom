@echo off
cd /d %~dp0
echo ========================================
echo Starting CRM System - All Services
echo ========================================
echo.

REM Kill existing processes on ports 8000 and 5173
echo Step 1: Cleaning up existing processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Killing process %%a on port 8000
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    echo Killing process %%a on port 5173
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo.

REM Start Backend
echo Step 2: Starting Backend Server...
start "CRM Backend" cmd /k "cd /d %~dp0backend && START_SERVER.bat"
timeout /t 3 /nobreak >nul
echo.

REM Start Frontend
echo Step 3: Starting Frontend Server...
start "CRM Frontend" cmd /k "cd /d %~dp0frontend && START_FRONTEND.bat"
timeout /t 3 /nobreak >nul
echo.

echo ========================================
echo All services started!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Two windows opened - one for backend, one for frontend.
echo Close those windows to stop the servers.
echo.
echo Press any key to exit this window (servers will keep running)...
pause >nul
