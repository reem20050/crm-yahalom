@echo off
chcp 65001 >nul
echo ========================================
echo  התחברות מחדש ל-GitHub Repository
echo ========================================
echo.

REM Change to project directory
cd /d "%~dp0"

echo [1/3] מסיר את ה-remote הישן...
git remote remove origin
echo.

echo [2/3] מוסיף את ה-remote החדש...
git remote add origin https://github.com/reem20050/crm-yahalom.git
echo.

echo [3/3] דוחף את הקוד ל-GitHub...
git push -u origin main
echo.

echo ========================================
echo  הסתיים בהצלחה!
echo ========================================
echo.
echo הקוד נדחף ל-GitHub.
echo עכשיו תוכל ליצור Railway Project חדש ולהתחבר ל-GitHub.
echo.
pause
