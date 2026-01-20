@echo off
echo ========================================
echo Setting up Auto-Start for CRM System
echo ========================================
echo.
echo This will create a Windows Task that starts the CRM system
echo automatically when Windows starts.
echo.
echo Press any key to continue or CTRL+C to cancel...
pause >nul
echo.

REM Get the current directory
set SCRIPT_DIR=%~dp0
set START_SCRIPT=%SCRIPT_DIR%START_ALL.bat

REM Create the task
echo Creating Windows Task...
schtasks /create /tn "CRM System Auto Start" /tr "\"%START_SCRIPT%\"" /sc onlogon /rl highest /f

if errorlevel 1 (
    echo.
    echo ERROR: Failed to create task. You may need to run as Administrator.
    echo.
    echo To create manually:
    echo 1. Open Task Scheduler (taskschd.msc)
    echo 2. Create Basic Task
    echo 3. Name: "CRM System Auto Start"
    echo 4. Trigger: "When I log on"
    echo 5. Action: Start a program
    echo 6. Program: "%START_SCRIPT%"
    pause
    exit /b 1
)

echo.
echo ========================================
echo Task created successfully!
echo ========================================
echo.
echo The CRM system will now start automatically when you log in.
echo.
echo To disable: Open Task Scheduler and delete "CRM System Auto Start"
echo To test: Run "START_ALL.bat" manually
echo.
pause
