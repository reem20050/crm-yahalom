@echo off
chcp 65001 >nul
echo ========================================
echo  יצירת מחדש של GitHub Repository
echo ========================================
echo.

REM Change to project directory
cd /d "%~dp0"

echo [1/4] בודק את ה-Git status...
git status
echo.

echo [2/4] מוסיף את כל השינויים...
git add .
echo.

echo [3/4] יוצר commit...
git commit -m "Initial commit - clean start"
echo.

echo [4/4] מכין את ה-branch...
git branch -M main
echo.

echo ========================================
echo  הכנה הסתיימה!
echo ========================================
echo.
echo עכשיו תעשה:
echo 1. מחק את ה-Repository הישן ב-GitHub
echo 2. צור Repository חדש ב-GitHub (crm-yahalom)
echo 3. תריץ את הפקודות הבאות:
echo.
echo    git remote remove origin
echo    git remote add origin https://github.com/reem20050/crm-yahalom.git
echo    git push -u origin main
echo.
echo או תריץ את RECONNECT_GIT_REPO.bat
echo.
pause
