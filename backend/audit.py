"""
Audit logging helper functions.
Logs critical actions with request context for accountability.
"""
from sqlalchemy.orm import Session
from fastapi import Request
from datetime import datetime
import json
import models


def log_audit_event(
    db: Session,
    request: Request,
    user,
    action: str,
    resource_type: str,
    resource_id: int,
    old_value: dict = None,
    new_value: dict = None,
    success: bool = True,
    error_message: str = None
):
    """
    Log an audit event with request context.
    
    Args:
        db: Database session
        request: FastAPI Request object (for IP, user agent, correlation ID)
        user: User model instance (can be None for anonymous actions)
        action: Action type (create, update, delete, role_change)
        resource_type: Type of resource (user, employee, client, shift, task)
        resource_id: ID of the affected resource
        old_value: Previous state as dict (will be serialized to JSON)
        new_value: New state as dict (will be serialized to JSON)
        success: Whether the action succeeded
        error_message: Error message if action failed
    """
    # Get correlation ID from request state
    request_id = getattr(request.state, "correlation_id", None)
    
    # Get IP address
    ip_address = None
    if request.client:
        ip_address = request.client.host
    
    # Get user agent
    user_agent = request.headers.get("user-agent", None)
    
    # Serialize old/new values to JSON strings
    old_value_json = json.dumps(old_value) if old_value else None
    new_value_json = json.dumps(new_value) if new_value else None
    
    # Create audit log entry
    audit_log = models.AuditLog(
        request_id=request_id,
        user_id=user.id if user else None,
        actor_email=user.email if user else None,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        old_value=old_value_json,
        new_value=new_value_json,
        success=success,
        error_message=error_message,
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.utcnow()
    )
    
    db.add(audit_log)
    db.commit()
    
    return audit_log


def get_diff_dict(old_obj, new_obj, fields_to_track: list[str]) -> tuple[dict, dict]:
    """
    Get dictionary of changed fields between old and new object.
    
    Args:
        old_obj: Object with old values
        new_obj: Object with new values (or dict)
        fields_to_track: List of field names to track changes for
    
    Returns:
        Tuple of (old_dict, new_dict) with only changed fields
    """
    old_dict = {}
    new_dict = {}
    
    # If new_obj is a dict (from Pydantic schema)
    new_data = new_obj if isinstance(new_obj, dict) else {f: getattr(new_obj, f, None) for f in fields_to_track}
    
    for field in fields_to_track:
        old_val = getattr(old_obj, field, None) if hasattr(old_obj, field) else None
        new_val = new_data.get(field) if isinstance(new_data, dict) else getattr(new_obj, field, None) if hasattr(new_obj, field) else None
        
        # Only track if value changed
        if old_val != new_val:
            old_dict[field] = str(old_val) if old_val is not None else None
            new_dict[field] = str(new_val) if new_val is not None else None
    
    return old_dict, new_dict
