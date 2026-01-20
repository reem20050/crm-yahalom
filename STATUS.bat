@echo off
echo ========================================
echo CRM System Status
echo ========================================
echo.

echo Checking Backend (port 8000)...
netstat -ano | findstr :8000 | findstr LISTENING >nul
if errorlevel 1 (
    echo [X] Backend is NOT running
) else (
    echo [✓] Backend is running on port 8000
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
        echo     PID: %%a
    )
)

echo.
echo Checking Frontend (port 5173)...
netstat -ano | findstr :5173 | findstr LISTENING >nul
if errorlevel 1 (
    echo [X] Frontend is NOT running
) else (
    echo [✓] Frontend is running on port 5173
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 ^| findstr LISTENING') do (
        echo     PID: %%a
    )
)

echo.
echo Checking ngrok...
tasklist | findstr ngrok.exe >nul
if errorlevel 1 (
    echo [X] ngrok is NOT running
) else (
    echo [✓] ngrok is running
)

echo.
echo Checking Cloudflare Tunnel...
tasklist | findstr cloudflared.exe >nul
if errorlevel 1 (
    echo [X] Cloudflare Tunnel is NOT running
) else (
    echo [✓] Cloudflare Tunnel is running
)

echo.
echo ========================================
echo URLs:
echo ========================================
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
pause
