"""
Middleware for security headers, CSRF protection, and request tracking.
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import uuid
import secrets
import os

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
CSRF_TOKEN_HEADER = "X-CSRF-Token"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Add security headers to all responses:
    - Content-Security-Policy (CSP)
    - X-Content-Type-Options
    - X-Frame-Options
    - X-XSS-Protection
    """
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Content Security Policy
        # Allow Google OAuth scripts and frames
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://accounts.google.com; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "connect-src 'self' https://accounts.google.com; "
            "frame-src https://accounts.google.com; "
            "font-src 'self' data:;"
        )
        
        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"
        
        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"
        
        # XSS protection (legacy, but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"
        
        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        
        # Permissions Policy (formerly Feature-Policy)
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=()"
        )
        
        return response


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    Generate and store correlation ID for each request.
    Used for request tracking and logging.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Generate correlation ID
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        
        # Store in request state for use in handlers
        request.state.correlation_id = correlation_id
        
        # Process request
        response = await call_next(request)
        
        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id
        
        return response


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware.
    
    For POST/PUT/DELETE requests, validates CSRF token.
    Token can be sent via header (X-CSRF-Token) or cookie (csrf_token).
    
    Note: With SameSite=Lax cookies, CSRF protection is less critical,
    but still recommended for SameSite=Strict or additional security.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip CSRF check for safe methods
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return await call_next(request)
        
        # Skip CSRF check for auth endpoints (they handle their own security)
        if request.url.path in ["/auth/google", "/auth/logout", "/health"]:
            return await call_next(request)
        
        # Get CSRF token from header
        csrf_token_header = request.headers.get(CSRF_TOKEN_HEADER)
        
        # Get CSRF token from cookie
        csrf_token_cookie = request.cookies.get("csrf_token")
        
        # Validate CSRF token
        if not csrf_token_header or not csrf_token_cookie:
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token missing"}
            )
        
        if csrf_token_header != csrf_token_cookie:
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token mismatch"}
            )
        
        return await call_next(request)


def generate_csrf_token() -> str:
    """Generate a secure CSRF token."""
    return secrets.token_urlsafe(32)
