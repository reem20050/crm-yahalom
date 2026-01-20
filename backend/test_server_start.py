import subprocess
import sys
import os

os.environ['GOOGLE_CLIENT_ID'] = '833831270176-1c2ahvh32fbffuqkf5gp3ns1pieoe7lk.apps.googleusercontent.com'
os.environ['SECRET_KEY'] = 'some_random_secret'

print("Environment variables set:")
print(f"GOOGLE_CLIENT_ID: {os.getenv('GOOGLE_CLIENT_ID')}")
print(f"SECRET_KEY: {os.getenv('SECRET_KEY')}")
print()

print("Testing if we can import main...")
try:
    import main
    print("✓ main imported successfully")
except Exception as e:
    print(f"✗ Failed to import main: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print()
print("Testing if app exists...")
if hasattr(main, 'app'):
    print("✓ app exists")
else:
    print("✗ app does not exist!")
    sys.exit(1)

print()
print("All checks passed! Server should start successfully.")
print("Run: python -m uvicorn main:app --host 0.0.0.0 --port 8000")
