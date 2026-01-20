"""
Script to add an email to the allowed access list.
This is useful for adding the first admin email when the system is first set up.

Usage:
    python add_allowed_email.py <email> [notes]

Example:
    python add_allowed_email.py admin@example.com "First admin user"
"""
import sys
from database import SessionLocal
import crud, schemas

def add_email(email: str, notes: str = None):
    db = SessionLocal()
    try:
        allowed_email = schemas.AllowedEmailCreate(email=email, notes=notes)
        result = crud.add_allowed_email(db, allowed_email, added_by="system")
        if result:
            print(f"✓ Successfully added {email} to the allowed list")
            return True
        else:
            print(f"✗ Email {email} already exists in the allowed list")
            return False
    except Exception as e:
        print(f"✗ Error: {str(e)}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    email = sys.argv[1]
    notes = sys.argv[2] if len(sys.argv) > 2 else None
    
    success = add_email(email, notes)
    sys.exit(0 if success else 1)
