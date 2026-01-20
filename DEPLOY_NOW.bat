@echo off
echo ========================================
echo Railway Deployment Helper
echo ========================================
echo.

echo Step 1: Checking Git status...
git status
echo.

echo Step 2: Latest commits...
git log --oneline -3
echo.

echo ========================================
echo IMPORTANT: Manual Steps Required
echo ========================================
echo.
echo The code has been pushed to GitHub.
echo Now you need to trigger deployment in Railway:
echo.
echo OPTION 1: Railway Dashboard (Easiest)
echo ----------------------------------------
echo 1. Open: https://railway.app
echo 2. Login to your account
echo 3. Click on your project: "crm-yahalom-production"
echo 4. Click on the "Backend" service
echo 5. Click on "Settings" tab
echo 6. Scroll down to "Deploy"
echo 7. Click "Trigger Deploy" button
echo 8. Select "Deploy Latest" or "Redeploy"
echo 9. Wait for deployment to complete (check logs)
echo.
echo OPTION 2: Railway CLI (If installed)
echo ----------------------------------------
echo If you have Railway CLI installed, run:
echo   railway login
echo   railway link
echo   railway up
echo.
echo ========================================
echo After Deployment:
echo ========================================
echo.
echo 1. Check the deployment logs in Railway Dashboard
echo 2. Look for errors in red
echo 3. If successful, test: https://crm-yahalom-production.up.railway.app/
echo 4. Test health endpoint: https://crm-yahalom-production.up.railway.app/health
echo.
echo ========================================
echo.
pause
