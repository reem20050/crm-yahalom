@echo off
echo ========================================
echo Checking Deployment Status
echo ========================================
echo.

echo Checking if Railway URL is accessible...
echo.

curl -s -o nul -w "HTTP Status: %%{http_code}\n" https://crm-yahalom-production.up.railway.app/
echo.

curl -s -o nul -w "Health Check Status: %%{http_code}\n" https://crm-yahalom-production.up.railway.app/health
echo.

echo If you see 200, the site is working!
echo If you see 502 or 503, the service might be starting...
echo If you see 404, check the Railway dashboard for errors.
echo.
echo To check the actual response:
echo   curl https://crm-yahalom-production.up.railway.app/
echo   curl https://crm-yahalom-production.up.railway.app/health
echo.

pause
