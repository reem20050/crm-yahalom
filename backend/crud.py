from sqlalchemy.orm import Session
from datetime import datetime
import models, schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_count(db: Session):
    return db.query(models.User).count()

def list_users(db: Session):
    return db.query(models.User).order_by(models.User.id.asc()).all()

def update_user_role(db: Session, user_id: int, role: str):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return None
    user.role = role
    db.commit()
    db.refresh(user)
    return user

def create_google_user(db: Session, email: str, role: str = "user"):
    db_user = models.User(email=email, role=role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(username=user.username, hashed_password=hashed_password, role=user.role)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Employee CRUD ---
def get_employees(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Employee).offset(skip).limit(limit).all()

def get_employee_by_id(db: Session, employee_id: int):
    return db.query(models.Employee).filter(models.Employee.id == employee_id).first()

def create_employee(db: Session, employee: schemas.EmployeeCreate):
    db_employee = models.Employee(**employee.dict())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

def delete_employee(db: Session, employee_id: int):
    employee = get_employee_by_id(db, employee_id)
    if not employee:
        return None
    db.delete(employee)
    db.commit()
    return employee

# --- Client CRUD ---
def get_clients(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Client).offset(skip).limit(limit).all()

def get_client_by_id(db: Session, client_id: int):
    return db.query(models.Client).filter(models.Client.id == client_id).first()

def create_client(db: Session, client: schemas.ClientCreate):
    db_client = models.Client(**client.dict())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

def delete_client(db: Session, client_id: int):
    client = get_client_by_id(db, client_id)
    if not client:
        return None
    db.delete(client)
    db.commit()
    return client

# --- Shift CRUD ---
def get_shifts(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Shift).order_by(models.Shift.start_time.desc()).offset(skip).limit(limit).all()

def get_shift_by_id(db: Session, shift_id: int):
    return db.query(models.Shift).filter(models.Shift.id == shift_id).first()

def get_shifts_by_employee(db: Session, employee_id: int):
    return db.query(models.Shift).filter(models.Shift.employee_id == employee_id).order_by(models.Shift.start_time.desc()).all()

def get_shifts_by_date_range(db: Session, start_date: datetime, end_date: datetime):
    return db.query(models.Shift).filter(
        models.Shift.start_time >= start_date,
        models.Shift.end_time <= end_date,
    ).order_by(models.Shift.start_time.asc()).all()

def create_shift(db: Session, shift: schemas.ShiftCreate):
    db_shift = models.Shift(**shift.dict())
    db.add(db_shift)
    db.commit()
    db.refresh(db_shift)
    return db_shift

def update_shift(db: Session, shift_id: int, shift_data: schemas.ShiftCreate):
    shift = get_shift_by_id(db, shift_id)
    if not shift:
        return None
    for field, value in shift_data.dict().items():
        setattr(shift, field, value)
    db.commit()
    db.refresh(shift)
    return shift

def delete_shift(db: Session, shift_id: int):
    shift = get_shift_by_id(db, shift_id)
    if not shift:
        return None
    db.delete(shift)
    db.commit()
    return shift

# --- Task CRUD ---
def get_tasks(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Task).order_by(models.Task.created_at.desc()).offset(skip).limit(limit).all()

def get_task_by_id(db: Session, task_id: int):
    return db.query(models.Task).filter(models.Task.id == task_id).first()

def get_tasks_by_employee(db: Session, user_id: int):
    return db.query(models.Task).filter(models.Task.assigned_to == user_id).order_by(models.Task.due_date.asc()).all()

def create_task(db: Session, task: schemas.TaskCreate, created_by: int | None = None):
    db_task = models.Task(**task.dict(), created_by=created_by)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task(db: Session, task_id: int, task_data: schemas.TaskCreate):
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    for field, value in task_data.dict().items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task

def delete_task(db: Session, task_id: int):
    task = get_task_by_id(db, task_id)
    if not task:
        return None
    db.delete(task)
    db.commit()
    return task

# --- Notification CRUD ---
def get_notifications(db: Session, user_id: int):
    return db.query(models.Notification).filter(models.Notification.user_id == user_id).order_by(models.Notification.created_at.desc()).all()

def create_notification(db: Session, notification: schemas.NotificationCreate):
    db_notification = models.Notification(**notification.dict())
    db.add(db_notification)
    db.commit()
    db.refresh(db_notification)
    return db_notification

def mark_notification_read(db: Session, notification_id: int):
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notification:
        return None
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification

# --- Reports ---
def generate_shift_report(db: Session, start_date: datetime | None = None, end_date: datetime | None = None):
    query = db.query(models.Shift)
    if start_date:
        query = query.filter(models.Shift.start_time >= start_date)
    if end_date:
        query = query.filter(models.Shift.end_time <= end_date)
    shifts = query.all()
    return {
        "total_shifts": len(shifts),
        "scheduled_shifts": sum(1 for s in shifts if s.status == "scheduled"),
        "completed_shifts": sum(1 for s in shifts if s.status == "completed"),
        "canceled_shifts": sum(1 for s in shifts if s.status == "canceled"),
    }

def generate_employee_report(db: Session):
    employees = db.query(models.Employee).all()
    items = []
    for employee in employees:
        total_shifts = len(employee.shifts)
        active_shifts = sum(1 for s in employee.shifts if s.status == "scheduled")
        items.append({
            "employee_id": employee.id,
            "employee_name": f"{employee.first_name} {employee.last_name}",
            "total_shifts": total_shifts,
            "active_shifts": active_shifts,
        })
    return {"total_employees": len(employees), "items": items}

# --- Allowed Email CRUD ---
def is_email_allowed(db: Session, email: str) -> bool:
    """Check if an email is in the allowed list"""
    allowed = db.query(models.AllowedEmail).filter(models.AllowedEmail.email == email.lower()).first()
    return allowed is not None

def get_allowed_emails(db: Session, skip: int = 0, limit: int = 100):
    """Get all allowed emails"""
    return db.query(models.AllowedEmail).order_by(models.AllowedEmail.added_at.desc()).offset(skip).limit(limit).all()

def get_allowed_email_by_email(db: Session, email: str):
    """Get a specific allowed email by email address"""
    return db.query(models.AllowedEmail).filter(models.AllowedEmail.email == email.lower()).first()

def add_allowed_email(db: Session, allowed_email: schemas.AllowedEmailCreate, added_by: str = None):
    """Add an email to the allowed list"""
    # Check if already exists
    existing = get_allowed_email_by_email(db, allowed_email.email)
    if existing:
        return None  # Already exists
    
    db_allowed = models.AllowedEmail(
        email=allowed_email.email.lower(),
        notes=allowed_email.notes,
        added_by=added_by
    )
    db.add(db_allowed)
    db.commit()
    db.refresh(db_allowed)
    return db_allowed

def remove_allowed_email(db: Session, email: str):
    """Remove an email from the allowed list"""
    allowed = get_allowed_email_by_email(db, email)
    if not allowed:
        return None
    db.delete(allowed)
    db.commit()
    return allowed

# --- User Invite CRUD ---
def get_invite_by_email(db: Session, email: str):
    """Get invite by email address"""
    return db.query(models.UserInvite).filter(
        models.UserInvite.email == email.lower()
    ).first()

def get_invite_by_token(db: Session, token: str):
    """Get invite by token"""
    return db.query(models.UserInvite).filter(
        models.UserInvite.token == token
    ).first()

def get_invites(db: Session, skip: int = 0, limit: int = 100):
    """Get all invites"""
    return db.query(models.UserInvite).order_by(
        models.UserInvite.created_at.desc()
    ).offset(skip).limit(limit).all()

def create_invite(
    db: Session,
    invite: schemas.UserInviteCreate,
    invited_by: int = None
):
    """Create a new user invite"""
    from datetime import timedelta
    import secrets
    
    # Generate unique token
    token = secrets.token_urlsafe(32)
    
    # Set expiration (default 7 days)
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    db_invite = models.UserInvite(
        email=invite.email.lower(),
        role=invite.role,
        invited_by=invited_by,
        token=token,
        expires_at=expires_at,
        notes=invite.notes
    )
    db.add(db_invite)
    db.commit()
    db.refresh(db_invite)
    return db_invite

def delete_invite(db: Session, invite_id: int):
    """Delete an invite"""
    invite = db.query(models.UserInvite).filter(
        models.UserInvite.id == invite_id
    ).first()
    if not invite:
        return None
    db.delete(invite)
    db.commit()
    return invite

def mark_invite_accepted(db: Session, invite_id: int):
    """Mark invite as accepted"""
    invite = db.query(models.UserInvite).filter(
        models.UserInvite.id == invite_id
    ).first()
    if not invite:
        return None
    invite.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(invite)
    return invite
