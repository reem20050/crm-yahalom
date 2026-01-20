@echo off
echo ========================================
echo Stopping CRM System - All Services
echo ========================================
echo.

echo Stopping processes on port 8000 (Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Killing process %%a on port 8000
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Stopping processes on port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do (
    echo Killing process %%a on port 5173
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Stopping ngrok tunnels...
taskkill /F /IM ngrok.exe >nul 2>&1

echo.
echo Stopping Cloudflare tunnels...
taskkill /F /IM cloudflared.exe >nul 2>&1

echo.
echo ========================================
echo All services stopped!
echo ========================================
echo.
pause
