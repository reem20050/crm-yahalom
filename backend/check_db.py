import sqlite3
import os

db_path = 'crm.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"Tables: {tables}")
    
    # Check users table structure
    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        print(f"\nUsers table columns: {[col[1] for col in columns]}")
        
        # Check if email column exists
        has_email = any(col[1] == 'email' for col in columns)
        print(f"Has email column: {has_email}")
        
        # Count users
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        print(f"Users count: {user_count}")
    except Exception as e:
        print(f"Error checking users table: {e}")
    
    conn.close()
else:
    print("Database file does not exist")
