@echo off
echo ========================================
echo Railway Deployment - Interactive Script
echo ========================================
echo.
echo Since you're already logged in to Railway Dashboard,
echo this script will help you deploy via CLI.
echo.
echo Press any key to continue...
pause >nul

echo.
echo Step 1: Logging in to Railway CLI...
echo (This will open a browser - please approve the login)
echo.
call npm.cmd exec -- railway login
if %errorlevel% neq 0 (
    echo.
    echo Login failed. Please try again or use Railway Dashboard.
    echo Opening Railway Dashboard for manual deployment...
    start https://railway.app
    pause
    exit /b 1
)

echo.
echo Step 2: Linking to project...
echo (Select your project: crm-yahalom-production)
echo.
call npm.cmd exec -- railway link
if %errorlevel% neq 0 (
    echo.
    echo Failed to link project.
    echo Opening Railway Dashboard for manual deployment...
    start https://railway.app
    pause
    exit /b 1
)

echo.
echo Step 3: Deploying to Railway...
echo.
call npm.cmd exec -- railway up
if %errorlevel% neq 0 (
    echo.
    echo Deployment failed. Check the output above for errors.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deployment completed!
echo ========================================
echo.
echo Check your Railway dashboard to see the deployment status.
echo Opening dashboard...
start https://railway.app
echo.
pause
