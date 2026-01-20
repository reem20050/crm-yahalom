@echo off
echo ========================================
echo Deploy After GitHub Login
echo ========================================
echo.

cd /d "%~dp0.."

echo Setting up GitHub CLI path...
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

echo Checking GitHub login status...
"%GH_PATH%gh.exe" auth status
if errorlevel 1 (
    echo ERROR: Not logged in to GitHub!
    echo Please run QUICK_DEPLOY.bat first to login.
    pause
    exit /b 1
)

echo.
echo Step 1: Creating GitHub repository 'crm-yahalom'...
"%GH_PATH%\gh.exe" repo create crm-yahalom --public --source=. --remote=origin --push
if errorlevel 1 (
    echo.
    echo Repository might already exist. Checking...
    git remote -v
    if exist .git\config (
        echo.
        echo Trying to push to existing remote...
        git branch -M main 2>nul
        git push -u origin main
    ) else (
        echo.
        echo ERROR: Could not create repository.
        echo Please create it manually on GitHub and run:
        echo   git remote add origin https://github.com/YOUR_USERNAME/crm-yahalom.git
        echo   git push -u origin main
        pause
        exit /b 1
    )
) else (
    echo.
    echo ========================================
    echo SUCCESS! Repository created and code pushed!
    echo ========================================
)

echo.
echo Step 2: Connect Railway to GitHub
echo ----------------------------------------
echo.
echo 1. Go to: https://railway.app
echo 2. Select project: crm-yahalom-production  
echo 3. Go to: Settings ^> Source
echo 4. Click: "Connect GitHub Repo"
echo 5. Select: crm-yahalom
echo.
echo Railway will auto-deploy your code!
echo.
echo For future updates, just run:
echo   git add .
echo   git commit -m "your message"  
echo   git push
echo.
pause
