@echo off
echo Starting Backend...
cd /d "%~dp0..\backend"

REM Set environment variables for Google Auth (if not already set)
if "%GOOGLE_CLIENT_ID%"=="" (
    set GOOGLE_CLIENT_ID=833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com
)
if "%SECRET_KEY%"=="" (
    set SECRET_KEY=tzevet-yahalom-secret-key-2024-production
)

echo Environment variables set:
echo GOOGLE_CLIENT_ID=%GOOGLE_CLIENT_ID%
echo SECRET_KEY=%SECRET_KEY%

if exist "venv\Scripts\activate.bat" (
  call venv\Scripts\activate.bat
)
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
