import subprocess
import os
import sys

# Change to backend directory
os.chdir(r'C:\crm-yahalom\backend')

# Run the BAT file
subprocess.run([r'C:\crm-yahalom\backend\START_BACKEND.bat'], shell=True)
