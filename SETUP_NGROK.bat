@echo off
cd /d %~dp0
echo ========================================
echo Setting up ngrok Tunnel
echo ========================================
echo.

REM Check if ngrok is installed
where ngrok >nul 2>&1
if errorlevel 1 (
    echo ngrok is not installed!
    echo.
    echo To install:
    echo 1. Download from: https://ngrok.com/download
    echo 2. Extract ngrok.exe to a folder in your PATH
    echo    (or to this folder: %~dp0)
    echo 3. Sign up at: https://dashboard.ngrok.com/signup
    echo 4. Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
    echo 5. Run: ngrok config add-authtoken YOUR_TOKEN
    echo.
    pause
    exit /b 1
)

echo ngrok found!
echo.

REM Check if authtoken is configured
ngrok config check >nul 2>&1
if errorlevel 1 (
    echo ngrok authtoken not configured!
    echo.
    echo Get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
    echo Then run: ngrok config add-authtoken YOUR_TOKEN
    echo.
    pause
    exit /b 1
)

echo Starting ngrok tunnel for Frontend (port 5173)...
echo This will create a public URL like: https://xxxx-xx-xx-xx-xx.ngrok-free.app
echo.
start "ngrok Frontend" cmd /k "ngrok http 5173"

timeout /t 2 /nobreak >nul

echo.
echo Starting ngrok tunnel for Backend (port 8000)...
echo This will create a public URL like: https://yyyy-yy-yy-yy-yy.ngrok-free.app
echo.
start "ngrok Backend" cmd /k "ngrok http 8000"

echo.
echo ========================================
echo ngrok tunnels started!
echo ========================================
echo.
echo Check the two ngrok windows for your public URLs.
echo.
echo IMPORTANT: Update Google Cloud Console:
echo 1. Go to: https://console.cloud.google.com/
echo 2. APIs & Services > Credentials
echo 3. Edit your OAuth Client ID
echo 4. Add the ngrok URLs to "Authorized JavaScript origins"
echo    Example: https://xxxx-xx-xx-xx-xx.ngrok-free.app
echo.
echo Press any key to continue...
pause >nul
