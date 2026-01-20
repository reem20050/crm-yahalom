"""
Authentication module for JWT-based cookie authentication.
Uses HttpOnly Secure Cookies to prevent XSS attacks.
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
import os
import models
import crud
from database import get_db

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SECRET_KEY")
ALGORITHM = "HS256"
COOKIE_NAME = "access_token"

# Security scheme (legacy, but might be needed for some endpoints)
security = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> models.User:
    """
    Get current authenticated user from HttpOnly cookie.
    
    Reads JWT token from cookie, verifies it, and returns the user.
    Raises 401 if token is missing, invalid, or user not found.
    """
    # Try to get token from cookie first (preferred method)
    token = request.cookies.get(COOKIE_NAME)
    
    # Fallback: Try Authorization header (for compatibility during migration)
    if not token:
        authorization = request.headers.get("Authorization", "")
        if authorization.startswith("Bearer "):
            token = authorization[7:]
    
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        
        if email is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing email",
            )
        
        user = crud.get_user_by_email(db, email=email)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        
        return user
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )


def get_optional_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> models.User | None:
    """
    Get current user if authenticated, otherwise return None.
    Useful for endpoints that work both authenticated and unauthenticated.
    """
    try:
        return get_current_user(request, db)
    except HTTPException:
        return None
