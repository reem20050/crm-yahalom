from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging

logger = logging.getLogger(__name__)

# Database URL from environment variable
# Production/Staging: PostgreSQL via DATABASE_URL (required)
# Development: SQLite fallback for local development
DATABASE_URL = os.getenv("DATABASE_URL")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

if not DATABASE_URL:
    # In production/staging, DATABASE_URL is required
    if ENVIRONMENT in ["production", "staging"]:
        error_msg = "[database] DATABASE_URL is required in production/staging but is not set!"
        logger.error(error_msg)
        raise ValueError(error_msg)
    # Fallback to SQLite only for local development
    DATABASE_URL = "sqlite:///./crm.db"
    logger.warning(f"[database] DATABASE_URL not set, using SQLite: {DATABASE_URL}")
else:
    # Mask password in logs for security
    masked_url = DATABASE_URL.split("@")[-1] if "@" in DATABASE_URL else DATABASE_URL
    logger.info(f"[database] Using DATABASE_URL: ...@{masked_url}")

# Create engine
try:
    # For SQLite, use check_same_thread=False for compatibility
    if DATABASE_URL.startswith("sqlite"):
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    else:
        # For PostgreSQL, convert postgres:// to postgresql:// if needed (Railway uses postgres://)
        if DATABASE_URL.startswith("postgres://"):
            DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
            logger.info("[database] Converted postgres:// to postgresql://")
        # For PostgreSQL, no special connect_args needed
        engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)  # pool_pre_ping helps with connection issues
    logger.info("[database] Database engine created successfully")
except Exception as e:
    logger.error(f"[database] Error creating database engine: {str(e)}")
    logger.error(f"[database] DATABASE_URL value (masked): ...@{DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'N/A'}")
    raise

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
