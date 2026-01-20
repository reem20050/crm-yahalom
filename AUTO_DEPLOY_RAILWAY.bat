@echo off
echo ========================================
echo Railway Auto-Deploy Script
echo ========================================
echo.

echo IMPORTANT: This requires Railway CLI and your login
echo.

REM Try to use Railway CLI via npm
echo Step 1: Checking Railway CLI...
where railway >nul 2>&1
if %errorlevel% neq 0 (
    echo Railway CLI not found in PATH.
    echo Trying to use via npm...
    call npm.cmd exec -- railway --version
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: Railway CLI is not installed or accessible.
        echo.
        echo Please do ONE of the following:
        echo.
        echo OPTION A: Use Railway Dashboard (EASIEST)
        echo -----------------------------------------
        echo 1. Open: https://railway.app
        echo 2. Login
        echo 3. Go to project: crm-yahalom-production
        echo 4. Click Backend service
        echo 5. Click Deployments tab
        echo 6. Click "Trigger Deploy" button
        echo.
        echo OPTION B: Install Railway CLI manually
        echo -------------------------------------
        echo Run: npm install -g @railway/cli
        echo Then run this script again.
        echo.
        pause
        exit /b 1
    )
)

echo.
echo Step 2: Attempting to login to Railway...
echo (This will open a browser for authentication)
echo.
call npm.cmd exec -- railway login
if %errorlevel% neq 0 (
    echo.
    echo Login failed or cancelled.
    echo Please use Railway Dashboard instead (see instructions above).
    pause
    exit /b 1
)

echo.
echo Step 3: Linking to project...
call npm.cmd exec -- railway link
if %errorlevel% neq 0 (
    echo.
    echo Failed to link project.
    echo Please make sure you're in the correct directory.
    pause
    exit /b 1
)

echo.
echo Step 4: Deploying...
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
echo URL: https://crm-yahalom-production.up.railway.app/
echo.
pause
