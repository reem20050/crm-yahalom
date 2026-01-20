@echo off
cd /d %~dp0
echo ========================================
echo Starting Frontend Server
echo ========================================
echo.

echo Checking node_modules...
if not exist "node_modules" (
    echo node_modules not found! Installing dependencies...
    call npm.cmd install
    if errorlevel 1 (
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
)

echo.
echo Starting Vite development server...
echo Server will be available at: http://localhost:5173
echo Press CTRL+C to stop the server
echo ========================================
echo.

REM Keep the window open while Vite runs; when you stop it, you'll see the exit.
call npm.cmd run dev

echo.
echo Vite exited (if you pressed CTRL+C this is expected). Press any key to close.
pause >nul
