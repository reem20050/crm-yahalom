@echo off
echo Finding process on port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    echo Killing process %%a
    taskkill /F /PID %%a
)
echo Done.
pause
