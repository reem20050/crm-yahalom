"""
Global search functionality across multiple resources.
"""
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Dict, Any
import models


def search_all(query: str, db: Session, limit_per_type: int = 10) -> Dict[str, List[Dict[str, Any]]]:
    """
    Search across clients, employees, and shifts.
    
    Args:
        query: Search query string
        db: Database session
        limit_per_type: Maximum results per resource type
    
    Returns:
        Dictionary with resource types as keys and lists of results as values
    """
    results = {
        "clients": [],
        "employees": [],
        "shifts": []
    }
    
    search_term = f"%{query}%"
    
    # Search clients
    clients = db.query(models.Client).filter(
        or_(
            models.Client.name.ilike(search_term),
            models.Client.contact_person.ilike(search_term),
            models.Client.address.ilike(search_term),
            models.Client.email.ilike(search_term)
        )
    ).limit(limit_per_type).all()
    
    results["clients"] = [
        {
            "id": c.id,
            "name": c.name,
            "contact_person": c.contact_person,
            "type": "client"
        }
        for c in clients
    ]
    
    # Search employees
    employees = db.query(models.Employee).filter(
        or_(
            models.Employee.first_name.ilike(search_term),
            models.Employee.last_name.ilike(search_term),
            models.Employee.id_number.ilike(search_term),
            models.Employee.email.ilike(search_term)
        )
    ).limit(limit_per_type).all()
    
    results["employees"] = [
        {
            "id": e.id,
            "name": f"{e.first_name} {e.last_name}",
            "id_number": e.id_number,
            "type": "employee"
        }
        for e in employees
    ]
    
    # Search shifts (by employee name or client name)
    # This requires joins, so it's more complex
    from sqlalchemy.orm import joinedload
    shifts = db.query(models.Shift).join(
        models.Employee
    ).join(
        models.Client, isouter=True
    ).filter(
        or_(
            models.Employee.first_name.ilike(search_term),
            models.Employee.last_name.ilike(search_term),
            models.Client.name.ilike(search_term)
        )
    ).options(
        joinedload(models.Shift.employee),
        joinedload(models.Shift.client)
    ).limit(limit_per_type).all()
    
    results["shifts"] = [
        {
            "id": s.id,
            "employee_name": f"{s.employee.first_name} {s.employee.last_name}" if s.employee else None,
            "client_name": s.client.name if s.client else None,
            "start_time": s.start_time.isoformat() if s.start_time else None,
            "type": "shift"
        }
        for s in shifts
    ]
    
    return results
