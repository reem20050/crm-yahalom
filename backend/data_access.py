"""
Row-level data access control functions.
Applies WHERE clause filters based on user role.
"""
from sqlalchemy.orm import Query, Session
from sqlalchemy import and_
import models
from permissions import Role, get_role


def filter_shifts_by_role(db: Session, user: models.User, query: Query) -> Query:
    """
    Apply row-level filtering to shifts query based on user role.
    
    - Guard: Only their own shifts
    - ShiftLead: Assigned shifts (will need employee assignment model later)
    - Others: All shifts
    """
    role = get_role(user)
    
    if role == Role.Guard:
        # Guards see only their own shifts
        # Note: This assumes a relationship between User and Employee via email
        # For now, we'll need to get employee by user email
        # TODO: Add user_id to Employee model or link via email
        employee = db.query(models.Employee).filter(
            # Temporary: assume email matches some employee identifier
            # This needs proper implementation with User-Employee relationship
            models.Employee.first_name.ilike(f"%{user.email.split('@')[0]}%")
        ).first()
        
        if employee:
            return query.filter(models.Shift.employee_id == employee.id)
        else:
            # No employee record found, return empty query
            return query.filter(False)
    
    elif role == Role.ShiftLead:
        # ShiftLeads see shifts for their assigned site/job
        # TODO: Implement site/job assignment model
        # For now, return all shifts (can be refined later)
        return query
    
    # Admin, OperationsManager, Scheduler see all
    return query


def filter_employees_by_role(db: Session, user: models.User, query: Query) -> Query:
    """
    Apply row-level filtering to employees query based on user role.
    
    Currently all roles that can read employees see all employees.
    Row-level filtering can be added later if needed.
    """
    role = get_role(user)
    
    # For now, no row-level filtering for employees
    # All authorized roles see all employees
    return query


def filter_clients_by_role(db: Session, user: models.User, query: Query) -> Query:
    """
    Apply row-level filtering to clients query based on user role.
    
    - Sales: Only clients they created (if we track creator)
    - Others: All clients
    """
    role = get_role(user)
    
    if role == Role.Sales:
        # TODO: Add created_by field to Client model to track creator
        # For now, Sales sees all clients they have permission to read
        pass
    
    # All authorized roles see all clients for now
    return query


def filter_tasks_by_role(db: Session, user: models.User, query: Query) -> Query:
    """
    Apply row-level filtering to tasks query based on user role.
    
    - Guard, ShiftLead: Only tasks assigned to them
    - Others: All tasks
    """
    role = get_role(user)
    
    if role in [Role.Guard, Role.ShiftLead]:
        # Only tasks assigned to this user
        return query.filter(models.Task.assigned_to == user.id)
    
    # Admin, OperationsManager, Scheduler see all
    return query
