@echo off
echo ========================================
echo Auto Deploy to Railway - Step by Step
echo ========================================
echo.

echo Step 1: Checking Git status...
cd /d "%~dp0.."
git status
echo.

echo Step 2: Login to GitHub (will open browser)...
gh auth login --web
echo.

echo Step 3: Creating GitHub repository...
set REPO_NAME=crm-yahalom
gh repo create %REPO_NAME% --public --source=. --remote=origin --push
echo.

echo Step 4: Connecting Railway to GitHub...
echo Please go to Railway Dashboard:
echo 1. Go to: https://railway.app
echo 2. Select your project: crm-yahalom-production
echo 3. Go to Settings ^> Source
echo 4. Click "Connect GitHub Repo"
echo 5. Select: %REPO_NAME%
echo.

echo Step 5: Railway will auto-deploy!
echo Every time you run: git push
echo Railway will update automatically.
echo.

pause
