@echo off
echo ========================================
echo Railway Interactive Deployment
echo ========================================
echo.
echo I'll help you deploy step by step.
echo.
echo Step 1: Login to Railway CLI
echo (A browser window will open - please approve the login)
echo.
pause

call npm.cmd exec -- railway login
if %errorlevel% neq 0 (
    echo.
    echo Login failed. Please try again.
    pause
    exit /b 1
)

echo.
echo Step 2: Link to project
echo (Select your project: crm-yahalom-production)
echo.
call npm.cmd exec -- railway link
if %errorlevel% neq 0 (
    echo.
    echo Failed to link project. Please check the project name.
    pause
    exit /b 1
)

echo.
echo Step 3: Deploy to Railway
echo.
call npm.cmd exec -- railway up
if %errorlevel% neq 0 (
    echo.
    echo Deployment failed. Check the output above.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Deployment completed successfully!
echo ========================================
echo.
echo Check your Railway dashboard:
start https://railway.app
echo.
pause
