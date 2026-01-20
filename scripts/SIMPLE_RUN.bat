@echo off
echo ========================================
echo Starting CRM System - Simple Version
echo ========================================
echo.

echo Step 1: Starting Backend...
start "Backend Server" cmd /k "cd /d %~dp0..\backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo Step 2: Starting Frontend...
start "Frontend Server" cmd /k "cd /d %~dp0..\frontend && npm run dev"

echo.
echo ========================================
echo All services starting!
echo ========================================
echo.
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Check the 2 windows that opened.
echo Press any key to continue...
pause >nul
