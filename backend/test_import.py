import os
import sys

print("Testing imports...")

try:
    import sqlite3
    print("✓ sqlite3 imported")
except Exception as e:
    print(f"✗ sqlite3 import failed: {e}")
    sys.exit(1)

try:
    import json
    print("✓ json imported")
except Exception as e:
    print(f"✗ json import failed: {e}")
    sys.exit(1)

try:
    from fastapi import FastAPI
    print("✓ fastapi imported")
except Exception as e:
    print(f"✗ fastapi import failed: {e}")
    sys.exit(1)

try:
    import models
    print("✓ models imported")
except Exception as e:
    print(f"✗ models import failed: {e}")
    sys.exit(1)

print("\nTesting main.py import...")
try:
    import main
    print("✓ main.py imported successfully")
except Exception as e:
    print(f"✗ main.py import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\nAll tests passed!")
