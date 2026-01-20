@echo off
chcp 65001 >nul
echo ========================================
echo  הגדרה אוטומטית מלאה - Clean Start
echo ========================================
echo.

REM Change to project directory
cd /d "%~dp0"

echo [INFO] הקוד המקומי מוכן!
echo [INFO] יש 3 commits חדשים שלא נדחפו ל-GitHub
echo.

echo ========================================
echo  שלב 1: הכנה
echo ========================================
echo.

echo [1/6] בודק git status...
git status
echo.

echo ========================================
echo  שלב 2: מחיקה והתחברות מחדש
echo ========================================
echo.

echo [2/6] מסיר את ה-remote הישן...
git remote remove origin
echo ✓ הסתיים
echo.

echo [3/6] מוסיף את ה-remote החדש...
git remote add origin https://github.com/reem20050/crm-yahalom.git
echo ✓ הסתיים
echo.

echo ========================================
echo  שלב 3: העלאה ל-GitHub
echo ========================================
echo.

echo [4/6] דוחף את הקוד ל-GitHub...
echo [INFO] אם יש שגיאה - ודא שיצרת את ה-Repository החדש ב-GitHub!
git push -u origin main
echo.

if %ERRORLEVEL% EQU 0 (
    echo ✓ הסתיים בהצלחה!
) else (
    echo ✗ שגיאה! ודא ש:
    echo   1. מחקת את ה-Repository הישן ב-GitHub
    echo   2. יצרת Repository חדש: crm-yahalom
    echo   3. לא סימנת "Initialize with README"
    echo.
    pause
    exit /b 1
)

echo.

echo ========================================
echo  שלב 4: סיכום
echo ========================================
echo.

echo [5/6] בודק את ה-remote...
git remote -v
echo.

echo [6/6] מציג את ה-commits האחרונים...
git log --oneline -3
echo.

echo ========================================
echo  הושלם בהצלחה!
echo ========================================
echo.
echo הקוד נדחף ל-GitHub!
echo.
echo עכשיו תעשה:
echo 1. לך ל-Railway Dashboard: https://railway.app
echo 2. צור Project חדש
echo 3. בחר "Deploy from GitHub repo"
echo 4. בחר את reem20050/crm-yahalom
echo 5. הגדר Root Directory = backend
echo 6. הגדר Start Command = uvicorn main:app --host 0.0.0.0 --port $PORT
echo 7. הוסף PostgreSQL Database
echo 8. הגדר Environment Variables
echo.
echo הוראות מפורטות: CLEAN_START_INSTRUCTIONS.md
echo.
pause
