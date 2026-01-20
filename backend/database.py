<<<<<<< HEAD
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database URL from environment variable
# Production/Staging: PostgreSQL via DATABASE_URL (required)
# Development: SQLite fallback for local development
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Fallback to SQLite for local development
    DATABASE_URL = "sqlite:///./crm.db"
    print(f"[database] DATABASE_URL not set, using SQLite: {DATABASE_URL}")

# Create engine
# For SQLite, use check_same_thread=False for compatibility
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # For PostgreSQL, no special connect_args needed
    engine = create_engine(DATABASE_URL)

=======
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Default to SQLite for local dev; use DATABASE_URL in deployment.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./crm.db")

# check_same_thread=False is needed for SQLite with FastAPI.
connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
