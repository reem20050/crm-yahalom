from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

# Global variables - will be initialized on first use
_engine = None
_SessionLocal = None
_DATABASE_URL = None

def get_database_url():
    """Get DATABASE_URL from environment, with validation."""
    global _DATABASE_URL
    
    if _DATABASE_URL is not None:
        return _DATABASE_URL
    
    _DATABASE_URL = os.getenv("DATABASE_URL")
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    
    if not _DATABASE_URL:
        # In production/staging, DATABASE_URL is required
        if ENVIRONMENT in ["production", "staging"]:
            error_msg = "[database] DATABASE_URL is required in production/staging but is not set! Please set DATABASE_URL in Railway environment variables."
            logger.error(error_msg)
            # Don't raise here - let the app start and show clear error in logs
            return None
        # Fallback to SQLite only for local development
        _DATABASE_URL = "sqlite:///./crm.db"
        logger.warning(f"[database] DATABASE_URL not set, using SQLite: {_DATABASE_URL}")
    else:
        # Mask password in logs for security
        masked_url = _DATABASE_URL.split("@")[-1] if "@" in _DATABASE_URL else _DATABASE_URL
        logger.info(f"[database] Using DATABASE_URL: ...@{masked_url}")
    
    return _DATABASE_URL

def get_engine():
    """Get or create database engine."""
    global _engine
    
    if _engine is not None:
        return _engine
    
    DATABASE_URL = get_database_url()
    
    if not DATABASE_URL:
        # In production, this should not happen (handled in get_database_url)
        logger.error("[database] Cannot create engine: DATABASE_URL is not set")
        raise ValueError("DATABASE_URL is required but not set. Please configure it in Railway environment variables.")
    
    try:
        # For SQLite, use check_same_thread=False for compatibility
        if DATABASE_URL.startswith("sqlite"):
            _engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
        else:
            # For PostgreSQL, convert postgres:// to postgresql:// if needed (Railway uses postgres://)
            if DATABASE_URL.startswith("postgres://"):
                DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
                logger.info("[database] Converted postgres:// to postgresql://")
            # For PostgreSQL, no special connect_args needed
            _engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)
        logger.info("[database] Database engine created successfully")
    except Exception as e:
        logger.error(f"[database] Error creating database engine: {str(e)}")
        logger.error(f"[database] DATABASE_URL value (masked): ...@{DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else 'N/A'}")
        raise
    
    return _engine

def get_session_local():
    """Get or create session local."""
    global _SessionLocal
    
    if _SessionLocal is not None:
        return _SessionLocal
    
    try:
        engine = get_engine()
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        return _SessionLocal
    except Exception as e:
        logger.error(f"[database] Error creating SessionLocal: {str(e)}")
        raise

# For backward compatibility
def get_db():
    """Get database session."""
    try:
        SessionLocal = get_session_local()
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[database] Error getting database session: {str(e)}")
        raise

# Initialize engine and SessionLocal on import for backward compatibility
# But wrap in try-except to allow app to start even if DB is not configured
try:
    engine = get_engine()
    SessionLocal = get_session_local()
except Exception as e:
    logger.warning(f"[database] Database initialization failed: {str(e)}")
    logger.warning("[database] App will start but database operations may fail. Please configure DATABASE_URL.")
    # Set to None so we can detect it later
    engine = None
    SessionLocal = None
