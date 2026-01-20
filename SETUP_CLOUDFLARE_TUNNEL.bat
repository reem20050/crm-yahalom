@echo off
cd /d %~dp0
echo ========================================
echo Setting up Cloudflare Tunnel
echo ========================================
echo.

REM Check if cloudflared is installed
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo cloudflared is not installed!
    echo.
    echo To install:
    echo 1. Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
    echo 2. Extract cloudflared.exe to a folder in your PATH
    echo    (or to this folder: %~dp0)
    echo.
    pause
    exit /b 1
)

echo cloudflared found!
echo.

REM Check if already logged in
cloudflared tunnel list >nul 2>&1
if errorlevel 1 (
    echo Not logged in to Cloudflare!
    echo.
    echo To login:
    echo 1. Sign up at: https://dash.cloudflare.com/sign-up
    echo 2. Run: cloudflared tunnel login
    echo.
    pause
    exit /b 1
)

echo Starting Cloudflare Tunnel...
echo This will create public URLs for both frontend and backend.
echo.

REM Create config file if it doesn't exist
if not exist "cloudflare-tunnel.yml" (
    echo Creating cloudflare-tunnel.yml...
    (
        echo tunnel: crm-yahalom
        echo credentials-file: %~dp0cloudflare-tunnel-credentials.json
        echo.
        echo ingress:
        echo   - hostname: crm-frontend.your-domain.com
        echo     service: http://localhost:5173
        echo   - hostname: crm-backend.your-domain.com
        echo     service: http://localhost:8000
        echo   - service: http_status:404
    ) > cloudflare-tunnel.yml
    echo.
    echo NOTE: You need to:
    echo 1. Create a tunnel: cloudflared tunnel create crm-yahalom
    echo 2. Configure DNS: cloudflared tunnel route dns crm-yahalom crm-frontend.your-domain.com
    echo 3. Configure DNS: cloudflared tunnel route dns crm-yahalom crm-backend.your-domain.com
    echo.
    echo For quick test (random domain), use: cloudflared tunnel --url http://localhost:5173
    echo.
    pause
    exit /b 1
)

echo Starting tunnel...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel run crm-yahalom"

echo.
echo ========================================
echo Cloudflare Tunnel started!
echo ========================================
echo.
echo Check the tunnel window for your public URLs.
echo.
echo IMPORTANT: Update Google Cloud Console with the new URLs.
echo.
pause
