import os
import sys
import subprocess
import time

# Set environment variables
os.environ['GOOGLE_CLIENT_ID'] = '833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com'
os.environ['SECRET_KEY'] = 'some_random_secret'

print("=" * 50)
print("Starting Backend Server...")
print("=" * 50)
print()
print("Environment variables set:")
print(f"GOOGLE_CLIENT_ID: {os.environ.get('GOOGLE_CLIENT_ID')}")
print(f"SECRET_KEY: {os.environ.get('SECRET_KEY')}")
print()

# Change to backend directory
os.chdir(r'C:\crm-yahalom\backend')

# Get Python from venv
venv_python = r'C:\crm-yahalom\backend\venv\Scripts\python.exe'

if not os.path.exists(venv_python):
    print("ERROR: Virtual environment not found!")
    print(f"Looking for: {venv_python}")
    sys.exit(1)

print("Starting uvicorn server...")
print("=" * 50)
print()

# Run uvicorn
try:
    subprocess.run([venv_python, '-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'])
except KeyboardInterrupt:
    print("\nServer stopped.")
except Exception as e:
    print(f"Error starting server: {e}")
    sys.exit(1)
