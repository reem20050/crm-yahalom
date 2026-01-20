@echo off
echo ========================================
echo Complete Railway Deployment
echo ========================================
echo.

cd /d "%~dp0"

echo Step 1: Setting up GitHub CLI path...
set "GH_PATH=C:\Program Files\GitHub CLI"
if not exist "%GH_PATH%\gh.exe" (
    for /f "delims=" %%i in ('where gh 2^>nul') do set "GH_PATH=%%~dpi"
    if not exist "%GH_PATH%\gh.exe" (
        echo ERROR: GitHub CLI not found!
        pause
        exit /b 1
    )
)
set "PATH=%PATH%;%GH_PATH%"

echo Step 2: Checking GitHub login...
"%GH_PATH%gh.exe" auth status
if errorlevel 1 (
    echo Not logged in. Starting login process...
    "%GH_PATH%gh.exe" auth login --web
    echo Please complete the login in your browser, then press any key to continue...
    pause >nul
)

echo.
echo Step 3: Creating GitHub repository...
set REPO_NAME=crm-yahalom
"%GH_PATH%\gh.exe" repo create %REPO_NAME% --public --source=. --remote=origin --push
if errorlevel 1 (
    echo Repository might already exist or there was an error.
    echo Checking if remote exists...
    git remote -v
    if errorlevel 1 (
        echo Adding remote manually...
        echo Please provide your GitHub username:
        set /p GITHUB_USER=
        git remote add origin https://github.com/%GITHUB_USER%/%REPO_NAME%.git
        git branch -M main
        git push -u origin main
    ) else (
        echo Remote exists, pushing code...
        git branch -M main
        git push -u origin main
    )
) else (
    echo Repository created and code pushed successfully!
)

echo.
echo Step 4: Next steps for Railway...
echo.
echo 1. Go to: https://railway.app
echo 2. Select your project: crm-yahalom-production
echo 3. Go to Settings ^> Source
echo 4. Click "Connect GitHub Repo"
echo 5. Select: %REPO_NAME%
echo 6. Railway will auto-deploy!
echo.
echo After connecting, every 'git push' will auto-update Railway.
echo.

pause
