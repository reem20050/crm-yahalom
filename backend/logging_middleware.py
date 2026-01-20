"""
Request/response logging middleware with sensitive field redaction.
"""
import time
import json
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)

# Fields to redact from logs
SENSITIVE_FIELDS = {
    "password",
    "hashed_password",
    "token",
    "access_token",
    "credential",
    "authorization",
    "cookie",
    "csrf_token",
    "secret",
    "api_key",
    "secret_key"
}


def redact_sensitive_data(data: dict) -> dict:
    """
    Redact sensitive fields from data dictionary.
    """
    if not isinstance(data, dict):
        return data
    
    redacted = {}
    for key, value in data.items():
        key_lower = key.lower()
        
        # Check if key contains sensitive field name
        if any(sensitive in key_lower for sensitive in SENSITIVE_FIELDS):
            redacted[key] = "[REDACTED]"
        elif isinstance(value, dict):
            redacted[key] = redact_sensitive_data(value)
        elif isinstance(value, list):
            redacted[key] = [
                redact_sensitive_data(item) if isinstance(item, dict) else item
                for item in value
            ]
        else:
            redacted[key] = value
    
    return redacted


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Log all requests and responses with correlation ID, timing, and status.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Get correlation ID from request state (set by CorrelationIDMiddleware)
        correlation_id = getattr(request.state, "correlation_id", "unknown")
        
        # Start timer
        start_time = time.time()
        
        # Log request
        request_log = {
            "correlation_id": correlation_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": dict(request.query_params),
            "user_ip": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }
        
        # Redact sensitive query params
        if request_log["query_params"]:
            request_log["query_params"] = redact_sensitive_data(request_log["query_params"])
        
        logger.info(f"Request started: {request.method} {request.url.path}", extra=request_log)
        
        # Process request
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log response
            response_log = {
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
            }
            
            logger.info(
                f"Request completed: {request.method} {request.url.path} - {response.status_code}",
                extra=response_log
            )
            
            return response
            
        except Exception as e:
            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000
            
            # Log error
            error_log = {
                "correlation_id": correlation_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": 500,
                "duration_ms": round(duration_ms, 2),
                "error": str(e),
                "error_type": type(e).__name__
            }
            
            logger.error(
                f"Request failed: {request.method} {request.url.path}",
                extra=error_log,
                exc_info=True
            )
            
            # Re-raise to let FastAPI handle it
            raise
