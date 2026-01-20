@echo off
cd /d %~dp0
call venv\Scripts\activate.bat
set GOOGLE_CLIENT_ID=833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com
set SECRET_KEY=some_random_secret
python test_server_start.py
pause
