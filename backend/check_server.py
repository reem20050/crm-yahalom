import socket
import time

time.sleep(2)

try:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', 8000))
    sock.close()
    if result == 0:
        print("✓ Server is running on port 8000")
    else:
        print("✗ Server is NOT running on port 8000")
except Exception as e:
    print(f"Error checking server: {e}")
