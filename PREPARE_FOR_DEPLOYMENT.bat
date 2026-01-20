@echo off
setlocal
cd /d %~dp0

echo ========================================
echo Preparing CRM for Deployment
echo ========================================
echo.

set FAILED=0

call :check backend\Procfile
call :check backend\runtime.txt
call :check backend\requirements.txt
call :check backend\main.py
call :check backend\database.py
call :check frontend\package.json
call :check frontend\vite.config.js
call :check frontend\src\api.js

if not exist ".gitignore" (
  echo [WARN] .gitignore missing - creating a basic one...
  (
    echo # Python
    echo __pycache__/
    echo *.py[cod]
    echo *.pyd
    echo *.db
    echo *.sqlite3
    echo venv/
    echo .venv/
    echo.
    echo # Node
    echo node_modules/
    echo dist/
    echo npm-debug.log*
    echo yarn-error.log*
    echo.
    echo # Env
    echo .env
    echo .env.*
    echo.
    echo # OS
    echo .DS_Store
    echo Thumbs.db
  ) > .gitignore
)

echo.
if "%FAILED%"=="1" (
  echo [X] Missing required files. Fix the items above.
  pause
  exit /b 1
)

echo [OK] Ready for deployment.
pause
exit /b 0

:check
if not exist "%~1" (
  echo [X] Missing %~1
  set FAILED=1
) else (
  echo [OK] %~1
)
exit /b 0