import os
import subprocess
import socket
import sys

# Set environment variables
os.environ['GOOGLE_CLIENT_ID'] = '833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com'
os.environ['SECRET_KEY'] = 'some_random_secret'

# Kill process on port 8000
def kill_port(port):
    try:
        result = subprocess.run(
            ['netstat', '-ano'],
            capture_output=True,
            text=True,
            shell=True
        )
        for line in result.stdout.split('\n'):
            if f':{port}' in line and 'LISTENING' in line:
                parts = line.split()
                if len(parts) > 4:
                    pid = parts[-1]
                    try:
                        subprocess.run(['taskkill', '/F', '/PID', pid], check=False)
                        print(f"Killed process {pid} on port {port}")
                    except:
                        pass
    except:
        pass

print("Killing any process on port 8000...")
kill_port(8000)

print("\nStarting server...")
print(f"GOOGLE_CLIENT_ID: {os.environ.get('GOOGLE_CLIENT_ID', 'NOT SET')}")
print(f"SECRET_KEY: {os.environ.get('SECRET_KEY', 'NOT SET')}\n")

# Start uvicorn
subprocess.run([sys.executable, '-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'])
