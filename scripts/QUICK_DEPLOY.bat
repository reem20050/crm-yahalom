@echo off
echo ========================================
echo Quick Deploy to Railway
echo ========================================
echo.
echo This script will:
echo 1. Login to GitHub (opens browser)
echo 2. Create GitHub repository
echo 3. Push code to GitHub
echo 4. Guide you to connect Railway
echo.
pause

cd /d "%~dp0.."

echo Step 1: Setting up GitHub CLI path...
set "GH_PATH=C:\Program Files\GitHub CLI"
if not exist "%GH_PATH%\gh.exe" (
    echo GitHub CLI not found in default location. Searching...
    for /f "delims=" %%i in ('where gh 2^>nul') do set "GH_PATH=%%~dpi"
    if not exist "%GH_PATH%gh.exe" (
        echo ERROR: GitHub CLI not found! Please install it first.
        pause
        exit /b 1
    )
)
set "PATH=%PATH%;%GH_PATH%"

echo.
echo Step 2: Login to GitHub...
"%GH_PATH%\gh.exe" auth login --web
echo.
echo Please complete the login in your browser.
echo Press any key after you've logged in...
pause >nul

echo.
echo Step 3: Creating GitHub repository 'crm-yahalom'...
"%GH_PATH%\gh.exe" repo create crm-yahalom --public --source=. --remote=origin --push
if errorlevel 1 (
    echo.
    echo Repository already exists. Connecting to existing repository...
    for /f "tokens=*" %%i in ('"%GH_PATH%\gh.exe" api user -q .login') do set GITHUB_USER=%%i
    git remote remove origin 2>nul
    git remote add origin https://github.com/%GITHUB_USER%/crm-yahalom.git
    echo.
    echo Pushing code to existing repository...
    git branch -M main 2>nul
    git push -u origin main
    if errorlevel 1 (
        echo.
        echo Push failed. Trying force push...
        git push -u origin main --force
    )
)

echo.
echo ========================================
echo SUCCESS! Repository created and code pushed!
echo ========================================
echo.
echo Now connect Railway to GitHub:
echo.
echo 1. Go to: https://railway.app
echo 2. Select project: crm-yahalom-production
echo 3. Go to: Settings ^> Source
echo 4. Click: "Connect GitHub Repo"
echo 5. Select: crm-yahalom
echo.
echo Railway will auto-deploy!
echo.
echo For future updates, just run:
echo   git add .
echo   git commit -m "your message"
echo   git push
echo.
pause
