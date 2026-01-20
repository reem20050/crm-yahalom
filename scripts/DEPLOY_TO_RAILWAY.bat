@echo off
echo ========================================
echo Railway Deployment Helper
echo ========================================
echo.

echo Option 1: Manual Deploy via Railway Dashboard
echo ----------------------------------------
echo 1. Go to: https://railway.app
echo 2. Select your project: crm-yahalom-production
echo 3. Click on your Backend service
echo 4. Go to Settings ^> Trigger Deploy ^> Deploy Latest
echo.
echo Option 2: Deploy via Railway CLI (requires login)
echo ----------------------------------------
echo 1. Open a NEW terminal window
echo 2. Run: railway login
echo 3. After login, run: railway link
echo 4. Then run: railway up
echo.
echo Option 3: Connect to GitHub (recommended for auto-updates)
echo ----------------------------------------
echo 1. Create a GitHub repository
echo 2. Run these commands:
echo    git remote add origin YOUR_GITHUB_REPO_URL
echo    git push -u origin main
echo 3. In Railway Dashboard: Settings ^> Source ^> Connect GitHub Repo
echo.

pause
