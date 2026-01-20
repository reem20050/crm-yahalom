@echo off
cd /d %~dp0
echo Testing imports...
echo.
call venv\Scripts\activate.bat
python test_import.py
pause
