"""
Role-Based Access Control (RBAC) system.
Defines roles, permissions, and access control functions.
"""
from enum import Enum
from typing import List
from fastapi import Depends, HTTPException, status, Request
import models
from auth import get_current_user
from database import get_db
from sqlalchemy.orm import Session


class Role(str, Enum):
    """Available user roles in the system."""
    Admin = "Admin"
    OperationsManager = "OperationsManager"
    Scheduler = "Scheduler"
    Sales = "Sales"
    Finance = "Finance"
    ShiftLead = "ShiftLead"
    Guard = "Guard"


# Permission matrix: Maps roles to their allowed actions
PERMISSIONS = {
    Role.Admin: {
        "users": {"read": True, "write": True, "delete": True},
        "invites": {"read": True, "write": True, "delete": True},
        "allowed_emails": {"read": True, "write": True, "delete": True},
        "employees": {"read": True, "write": True, "delete": True},
        "clients": {"read": True, "write": True, "delete": True},
        "shifts": {"read": "all", "write": True, "delete": True},
        "tasks": {"read": "all", "write": True, "delete": True},
        "audit_logs": {"read": True, "write": False, "delete": False},
        "invoices": {"read": True, "write": True, "delete": True},
    },
    Role.OperationsManager: {
        "users": {"read": False, "write": False, "delete": False},
        "invites": {"read": False, "write": False, "delete": False},
        "allowed_emails": {"read": False, "write": False, "delete": False},
        "employees": {"read": True, "write": True, "delete": True},
        "clients": {"read": True, "write": True, "delete": True},
        "shifts": {"read": "all", "write": True, "delete": True},
        "tasks": {"read": "all", "write": True, "delete": True},
        "audit_logs": {"read": True, "write": False, "delete": False},
        "invoices": {"read": True, "write": False, "delete": False},
    },
    Role.Scheduler: {
        "users": {"read": False, "write": False, "delete": False},
        "invites": {"read": False, "write": False, "delete": False},
        "allowed_emails": {"read": False, "write": False, "delete": False},
        "employees": {"read": True, "write": True, "delete": False},
        "clients": {"read": True, "write": False, "delete": False},
        "shifts": {"read": "all", "write": True, "delete": True},
        "tasks": {"read": "all", "write": True, "delete": True},
        "audit_logs": {"read": False, "write": False, "delete": False},
        "invoices": {"read": False, "write": False, "delete": False},
    },
    Role.Sales: {
        "users": {"read": False, "write": False, "delete": False},
        "invites": {"read": False, "write": False, "delete": False},
        "allowed_emails": {"read": False, "write": False, "delete": False},
        "employees": {"read": False, "write": False, "delete": False},
        "clients": {"read": True, "write": True, "delete": True},
        "shifts": {"read": False, "write": False, "delete": False},
        "tasks": {"read": False, "write": False, "delete": False},
        "audit_logs": {"read": False, "write": False, "delete": False},
        "invoices": {"read": True, "write": False, "delete": False},
    },
    Role.Finance: {
        "users": {"read": False, "write": False, "delete": False},
        "invites": {"read": False, "write": False, "delete": False},
        "allowed_emails": {"read": False, "write": False, "delete": False},
        "employees": {"read": True, "write": False, "delete": False},
        "clients": {"read": True, "write": False, "delete": False},
        "shifts": {"read": False, "write": False, "delete": False},
        "tasks": {"read": False, "write": False, "delete": False},
        "audit_logs": {"read": False, "write": False, "delete": False},
        "invoices": {"read": True, "write": True, "delete": False},
    },
    Role.ShiftLead: {
        "users": {"read": False, "write": False, "delete": False},
        "invites": {"read": False, "write": False, "delete": False},
        "allowed_emails": {"read": False, "write": False, "delete": False},
        "employees": {"read": False, "write": False, "delete": False},
        "clients": {"read": False, "write": False, "delete": False},
        "shifts": {"read": "assigned", "write": False, "delete": False},  # Only own shifts
        "tasks": {"read": "assigned", "write": False, "delete": False},
        "audit_logs": {"read": False, "write": False, "delete": False},
        "invoices": {"read": False, "write": False, "delete": False},
    },
    Role.Guard: {
        "users": {"read": False, "write": False, "delete": False},
        "invites": {"read": False, "write": False, "delete": False},
        "allowed_emails": {"read": False, "write": False, "delete": False},
        "employees": {"read": False, "write": False, "delete": False},
        "clients": {"read": False, "write": False, "delete": False},
        "shifts": {"read": "own", "write": False, "delete": False},  # Only own shifts
        "tasks": {"read": "assigned", "write": False, "delete": False},
        "audit_logs": {"read": False, "write": False, "delete": False},
        "invoices": {"read": False, "write": False, "delete": False},
    },
}


def get_role(user: models.User) -> Role:
    """Convert user role string to Role enum."""
    try:
        return Role(user.role)
    except ValueError:
        # If role doesn't match enum, default to Guard (lowest privilege)
        return Role.Guard


def has_permission(user: models.User, resource: str, action: str) -> bool:
    """
    Check if user has permission for a resource action.
    
    Args:
        user: User model instance
        resource: Resource name (e.g., "employees", "clients")
        action: Action name (e.g., "read", "write", "delete")
    
    Returns:
        True if user has permission, False otherwise
    """
    role = get_role(user)
    resource_perms = PERMISSIONS.get(role, {}).get(resource, {})
    return resource_perms.get(action, False) is True or resource_perms.get(action) == "all"


def require_role(allowed_roles: List[Role]):
    """
    Dependency function to require specific roles.
    
    Usage:
        @app.get("/endpoint")
        def my_endpoint(current_user: User = Depends(require_role([Role.Admin, Role.OperationsManager]))):
            ...
    """
    def role_checker(
        request: Request,
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> models.User:
        user_role = get_role(current_user)
        
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {[r.value for r in allowed_roles]}. Your role: {user_role.value}"
            )
        
        return current_user
    
    return role_checker


def require_permission(resource: str, action: str):
    """
    Dependency function to require specific permission.
    
    Usage:
        @app.get("/employees")
        def get_employees(current_user: User = Depends(require_permission("employees", "read"))):
            ...
    """
    def permission_checker(
        request: Request,
        current_user: models.User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ) -> models.User:
        if not has_permission(current_user, resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. You don't have {action} permission for {resource}."
            )
        
        return current_user
    
    return permission_checker
