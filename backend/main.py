from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models, schemas, crud
from database import SessionLocal, engine
from google.oauth2 import id_token
from google.auth.transport import requests
from jose import jwt, JWTError
from datetime import datetime, timedelta
import os
import logging
from auth import get_current_user, COOKIE_NAME, get_optional_current_user
from middleware import (
    SecurityHeadersMiddleware,
    CorrelationIDMiddleware,
    CSRFProtectionMiddleware,
    generate_csrf_token
)
from permissions import require_role, Role, require_permission
from data_access import filter_shifts_by_role, filter_employees_by_role, filter_clients_by_role, filter_tasks_by_role

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Tzevet Yahalom CRM", version="0.1.0")

# CORS Configuration - environment-based
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# For development, allow localhost origins
# For production/staging, use FRONTEND_URL from environment
allowed_origins = [FRONTEND_URL]
if ENVIRONMENT == "development":
    allowed_origins.extend(["http://localhost:5173", "http://localhost:3000"])

# Add middleware in correct order
app.add_middleware(CorrelationIDMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
# CSRF middleware - uncomment if using SameSite=Strict
# app.add_middleware(CSRFProtectionMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Google Auth Configuration ---
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "YOUR_GOOGLE_CLIENT_ID")
SECRET_KEY = os.getenv("SECRET_KEY", "YOUR_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 day

# Startup logging
logger.info(f"[startup] GOOGLE_CLIENT_ID set: {GOOGLE_CLIENT_ID != 'YOUR_GOOGLE_CLIENT_ID'}")
logger.info(f"[startup] SECRET_KEY set: {SECRET_KEY != 'YOUR_SECRET_KEY'}")
if GOOGLE_CLIENT_ID != "YOUR_GOOGLE_CLIENT_ID":
    logger.info(f"[startup] GOOGLE_CLIENT_ID value: {GOOGLE_CLIENT_ID[:20]}...")
else:
    logger.warning("[startup] GOOGLE_CLIENT_ID not set! Using placeholder value.")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Authentication Dependencies ---
# Admin-only dependency using RBAC system
get_current_admin_user = require_role([Role.Admin])

@app.get("/")
def read_root():
    return {"message": "Welcome to Tzevet Yahalom CRM API"}


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint for monitoring and load balancers.
    Returns database connection status.
    """
    try:
        # Try a simple database query to verify connection
        db.execute("SELECT 1")
        db_status = "connected"
    except Exception as e:
        logger.error(f"[health] Database connection failed: {str(e)}")
        db_status = "disconnected"
    
    return {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat(),
        "environment": ENVIRONMENT
    }

@app.post("/auth/google")
def google_login(
    login_data: schemas.GoogleLogin,
    response: Response,
    db: Session = Depends(get_db)
):
    """
    Authenticate with Google OAuth credential.
    
    Verifies Google JWT credential with proper audience/issuer checks.
    Sets HttpOnly Secure Cookie with JWT access token.
    """
    credential_len = len(login_data.credential) if login_data.credential else 0
    client_id_set = GOOGLE_CLIENT_ID != "YOUR_GOOGLE_CLIENT_ID"
    logger.info(f"[auth/google] request received; credential_len={credential_len}; client_id_set={client_id_set}")
    
    try:
        # Check if GOOGLE_CLIENT_ID is configured
        if GOOGLE_CLIENT_ID == "YOUR_GOOGLE_CLIENT_ID":
            logger.error("[auth/google] GOOGLE_CLIENT_ID not configured!")
            raise HTTPException(
                status_code=500, 
                detail="GOOGLE_CLIENT_ID not configured on server. Please set GOOGLE_CLIENT_ID environment variable."
            )

        # Verify the Google credential with proper checks
        request_obj = requests.Request()
        id_info = id_token.verify_oauth2_token(
            login_data.credential,  # JWT credential from Google Identity Services
            request_obj, 
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10  # Allow 10s clock skew
        )
        
        # Verify audience (must match CLIENT_ID)
        if id_info.get('aud') != GOOGLE_CLIENT_ID:
            logger.error(f"[auth/google] Token audience mismatch: {id_info.get('aud')} != {GOOGLE_CLIENT_ID}")
            raise HTTPException(status_code=401, detail="Invalid Google credential: audience mismatch")
        
        # Verify issuer (must be Google)
        issuer = id_info.get('iss')
        if issuer not in ['accounts.google.com', 'https://accounts.google.com']:
            logger.error(f"[auth/google] Invalid issuer: {issuer}")
            raise HTTPException(status_code=401, detail="Invalid Google credential: invalid issuer")
        
        # Expiry is checked automatically by verify_oauth2_token
        logger.info(f"[auth/google] credential verified successfully")

        email = id_info.get("email")
        if not email:
            logger.warning("[auth/google] credential verified but no email found")
            raise HTTPException(status_code=400, detail="Google credential does not contain email")

        logger.info(f"[auth/google] email extracted: {email}")

        # Check OWNER_EMAIL bootstrap or email allowlist
        OWNER_EMAIL = os.getenv("OWNER_EMAIL", "").lower()
        email_lower = email.lower()
        
        if email_lower == OWNER_EMAIL:
            # Bootstrap: OWNER_EMAIL can always login, create admin if needed
            logger.info(f"[auth/google] OWNER_EMAIL login detected: {email}")
            user = crud.get_user_by_email(db, email=email)
            if not user:
                logger.info(f"[auth/google] creating bootstrap admin user for: {email}")
                user = crud.create_google_user(db, email=email, role="Admin")
        else:
            # Normal flow: Check invite first, then allowed list
            invite = crud.get_invite_by_email(db, email)
            role_from_invite = None
            
            if invite:
                # Check if invite is still valid
                if invite.accepted_at:
                    logger.warning(f"[auth/google] invite already used: {email}")
                    raise HTTPException(
                        status_code=403,
                        detail="This invite has already been used. Please contact an administrator."
                    )
                
                if invite.expires_at < datetime.utcnow():
                    logger.warning(f"[auth/google] invite expired: {email}")
                    raise HTTPException(
                        status_code=403,
                        detail="This invite has expired. Please contact an administrator."
                    )
                
                # Invite is valid, use role from invite
                role_from_invite = invite.role
                logger.info(f"[auth/google] valid invite found for {email}, role: {role_from_invite}")
            
            # Also check allowed_emails for backward compatibility
            elif not crud.is_email_allowed(db, email):
                logger.warning(f"[auth/google] access denied - email not in allowed list or invite: {email}")
                raise HTTPException(
                    status_code=403, 
                    detail="Access denied. Your email is not authorized to access this system. Please contact an administrator."
                )
            
            # Create or get user
            user = crud.get_user_by_email(db, email=email)
            if not user:
                # Create new user with role from invite if available, otherwise default
                user_role = role_from_invite or "Guard"  # Default to lowest privilege
                logger.info(f"[auth/google] creating new user for email: {email}, role: {user_role}")
                user = crud.create_google_user(db, email=email, role=user_role)
                
                # Mark invite as accepted if it was used
                if invite:
                    crud.mark_invite_accepted(db, invite.id)
                    logger.info(f"[auth/google] invite marked as accepted for: {email}")
            else:
                logger.info(f"[auth/google] existing user found: {email}")
        
        # Create JWT access token
        access_token = create_access_token(data={"sub": user.email, "role": user.role})
        logger.info(f"[auth/google] access token created successfully for: {email}")
        
        # Set HttpOnly Secure Cookie
        # SameSite=Lax provides good CSRF protection while allowing normal navigation
        is_secure = ENVIRONMENT != "development"  # Secure cookies only in production/staging
        
        response.set_cookie(
            key=COOKIE_NAME,
            value=access_token,
            httponly=True,  # Prevents XSS attacks
            secure=is_secure,  # HTTPS only in production
            samesite="lax",  # CSRF protection (can use "strict" for stronger protection)
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Cookie expires same as token
            path="/"  # Available on all paths
        )
        
        # Generate CSRF token and set as cookie
        csrf_token = generate_csrf_token()
        response.set_cookie(
            key="csrf_token",
            value=csrf_token,
            httponly=True,
            secure=is_secure,
            samesite="lax",
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            path="/"
        )
        
        # Return user info (token is in cookie)
        return {
            "message": "Authentication successful",
            "user": {
                "id": user.id,
                "email": user.email,
                "role": user.role
            },
            "csrf_token": csrf_token  # Return CSRF token for client to include in requests
        }

    except ValueError as e:
        # Invalid token
        logger.error(f"[auth/google] ValueError: {str(e)}")
        raise HTTPException(status_code=401, detail=f"Invalid Google credential: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[auth/google] Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/auth/logout")
def logout(response: Response):
    """Logout user by clearing authentication cookie."""
    response.delete_cookie(key=COOKIE_NAME, path="/")
    response.delete_cookie(key="csrf_token", path="/")
    return {"message": "Logged out successfully"}


@app.get("/auth/me")
def get_current_user_info(current_user: models.User = Depends(get_current_user)):
    """Get current authenticated user information."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role
    }

# --- Employee Routes ---
@app.post("/employees/", response_model=schemas.Employee)
def create_employee(
    employee: schemas.EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler]))
):
    """Create a new employee (Admin, OperationsManager, Scheduler only)"""
    return crud.create_employee(db=db, employee=employee)

@app.get("/employees/", response_model=list[schemas.Employee])
def read_employees(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.Finance]))
):
    """List employees (Admin, OperationsManager, Scheduler, Finance only)"""
    query = db.query(models.Employee)
    query = filter_employees_by_role(db, current_user, query)
    employees = query.offset(skip).limit(limit).all()
    return employees

@app.delete("/employees/{employee_id}", response_model=schemas.Employee)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager]))
):
    """Delete an employee (Admin, OperationsManager only)"""
    deleted = crud.delete_employee(db, employee_id=employee_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Employee not found")
    return deleted

# --- Client Routes ---
@app.post("/clients/", response_model=schemas.Client)
def create_client(
    client: schemas.ClientCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Sales]))
):
    """Create a new client (Admin, OperationsManager, Sales only)"""
    return crud.create_client(db=db, client=client)

@app.get("/clients/", response_model=list[schemas.Client])
def read_clients(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.Sales, Role.Finance]))
):
    """List clients (Admin, OperationsManager, Scheduler, Sales, Finance only)"""
    query = db.query(models.Client)
    query = filter_clients_by_role(db, current_user, query)
    clients = query.offset(skip).limit(limit).all()
    return clients

@app.delete("/clients/{client_id}", response_model=schemas.Client)
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Sales]))
):
    """Delete a client (Admin, OperationsManager, Sales only)"""
    deleted = crud.delete_client(db, client_id=client_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Client not found")
    return deleted

# --- Shift Routes ---
@app.get("/shifts/", response_model=list[schemas.Shift])
def read_shifts(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.ShiftLead, Role.Guard]))
):
    """List shifts with row-level filtering (Guard/ShiftLead see only assigned)"""
    query = db.query(models.Shift).order_by(models.Shift.start_time.desc())
    query = filter_shifts_by_role(db, current_user, query)
    shifts = query.offset(skip).limit(limit).all()
    return shifts

@app.post("/shifts/", response_model=schemas.Shift)
def create_shift(
    shift: schemas.ShiftCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler]))
):
    """Create a new shift (Admin, OperationsManager, Scheduler only)"""
    return crud.create_shift(db, shift)

@app.get("/shifts/{shift_id}", response_model=schemas.Shift)
def read_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.ShiftLead, Role.Guard]))
):
    """Get shift by ID with row-level filtering"""
    shift = crud.get_shift_by_id(db, shift_id=shift_id)
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    # Apply row-level filtering check
    from permissions import get_role
    role = get_role(current_user)
    if role in [Role.Guard, Role.ShiftLead]:
        # Check if user can access this shift (simplified - should check employee assignment)
        # TODO: Proper employee-user relationship check
        pass
    
    return shift

@app.put("/shifts/{shift_id}", response_model=schemas.Shift)
def update_shift(
    shift_id: int,
    shift_data: schemas.ShiftCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler]))
):
    """Update a shift (Admin, OperationsManager, Scheduler only)"""
    updated = crud.update_shift(db, shift_id=shift_id, shift_data=shift_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Shift not found")
    return updated

@app.delete("/shifts/{shift_id}", response_model=schemas.Shift)
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler]))
):
    """Delete a shift (Admin, OperationsManager, Scheduler only)"""
    deleted = crud.delete_shift(db, shift_id=shift_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Shift not found")
    return deleted

@app.get("/shifts/by-employee/{employee_id}", response_model=list[schemas.Shift])
def read_shifts_by_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.ShiftLead, Role.Guard]))
):
    """Get shifts by employee ID with row-level filtering"""
    query = db.query(models.Shift).filter(models.Shift.employee_id == employee_id)
    query = filter_shifts_by_role(db, current_user, query)
    return query.order_by(models.Shift.start_time.desc()).all()

@app.get("/shifts/by-date-range", response_model=list[schemas.Shift])
def read_shifts_by_date_range(
    start_date: datetime,
    end_date: datetime,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.ShiftLead, Role.Guard]))
):
    """Get shifts by date range with row-level filtering"""
    query = db.query(models.Shift).filter(
        models.Shift.start_time >= start_date,
        models.Shift.end_time <= end_date
    )
    query = filter_shifts_by_role(db, current_user, query)
    return query.order_by(models.Shift.start_time.asc()).all()

# --- Task Routes ---
@app.get("/tasks/", response_model=list[schemas.Task])
def read_tasks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.ShiftLead, Role.Guard]))
):
    """List tasks with row-level filtering (Guard/ShiftLead see only assigned)"""
    query = db.query(models.Task).order_by(models.Task.created_at.desc())
    query = filter_tasks_by_role(db, current_user, query)
    tasks = query.offset(skip).limit(limit).all()
    return tasks

@app.post("/tasks/", response_model=schemas.Task)
def create_task(
    task: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler]))
):
    """Create a new task (Admin, OperationsManager, Scheduler only)"""
    return crud.create_task(db, task, created_by=current_user.id)

@app.get("/tasks/{task_id}", response_model=schemas.Task)
def read_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.ShiftLead, Role.Guard]))
):
    """Get task by ID with row-level filtering"""
    task = crud.get_task_by_id(db, task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Apply row-level filtering check
    from permissions import get_role
    role = get_role(current_user)
    if role in [Role.Guard, Role.ShiftLead]:
        if task.assigned_to != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied. You can only view tasks assigned to you.")
    
    return task

@app.put("/tasks/{task_id}", response_model=schemas.Task)
def update_task(
    task_id: int,
    task_data: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler]))
):
    """Update a task (Admin, OperationsManager, Scheduler only)"""
    updated = crud.update_task(db, task_id=task_id, task_data=task_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return updated

@app.delete("/tasks/{task_id}", response_model=schemas.Task)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler]))
):
    """Delete a task (Admin, OperationsManager, Scheduler only)"""
    deleted = crud.delete_task(db, task_id=task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return deleted

@app.get("/tasks/by-employee/{user_id}", response_model=list[schemas.Task])
def read_tasks_by_employee(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.ShiftLead, Role.Guard]))
):
    """Get tasks by employee/user ID with row-level filtering"""
    # Guards/ShiftLeads can only see their own tasks
    from permissions import get_role
    role = get_role(current_user)
    if role in [Role.Guard, Role.ShiftLead] and user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied. You can only view your own tasks.")
    
    return crud.get_tasks_by_employee(db, user_id=user_id)

# --- Notification Routes ---
@app.get("/notifications/", response_model=list[schemas.Notification])
def read_notifications(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    return crud.get_notifications(db, user_id=user.id)

@app.post("/notifications/", response_model=schemas.Notification)
def create_notification(
    notification: schemas.NotificationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager]))
):
    """Create a notification (Admin, OperationsManager only)"""
    return crud.create_notification(db, notification)

@app.patch("/notifications/{notification_id}/read", response_model=schemas.Notification)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Mark notification as read (own notifications only)"""
    # Verify notification belongs to current user
    notification = db.query(models.Notification).filter(models.Notification.id == notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied. You can only mark your own notifications as read.")
    
    updated = crud.mark_notification_read(db, notification_id=notification_id)
    return updated

# --- Reports Routes ---
@app.get("/reports/shifts", response_model=schemas.ShiftReport)
def get_shift_report(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler]))
):
    """Get shift report (Admin, OperationsManager, Scheduler only)"""
    return crud.generate_shift_report(db, start_date=start_date, end_date=end_date)

@app.get("/reports/employees", response_model=schemas.EmployeeReport)
def get_employee_report(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin, Role.OperationsManager, Role.Scheduler, Role.Finance]))
):
    """Get employee report (Admin, OperationsManager, Scheduler, Finance only)"""
    return crud.generate_employee_report(db)

# --- Allowed Email Routes (Access List Management) ---
@app.get("/allowed-emails/", response_model=list[schemas.AllowedEmail])
def get_allowed_emails(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin]))
):
    """Get list of all allowed emails (Admin only)"""
    return crud.get_allowed_emails(db, skip=skip, limit=limit)

@app.post("/allowed-emails/", response_model=schemas.AllowedEmail)
def add_allowed_email(
    allowed_email: schemas.AllowedEmailCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin]))
):
    """Add an email to the allowed list (Admin only)"""
    result = crud.add_allowed_email(db, allowed_email, added_by=current_user.email)
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="Email already exists in the allowed list"
        )
    logger.info(f"[allowed-emails] {current_user.email} added {allowed_email.email} to allowed list")
    return result

@app.delete("/allowed-emails/{email}", response_model=schemas.AllowedEmail)
def remove_allowed_email(
    email: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin]))
):
    """Remove an email from the allowed list (Admin only)"""
    result = crud.remove_allowed_email(db, email)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Email not found in the allowed list"
        )
    logger.info(f"[allowed-emails] {current_user.email} removed {email} from allowed list")
    return result

# --- User Invite Routes ---
@app.post("/invites/", response_model=schemas.UserInvite)
def create_invite(
    invite: schemas.UserInviteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin]))
):
    """Create a new user invite (Admin only)"""
    result = crud.create_invite(db, invite, invited_by=current_user.id)
    logger.info(f"[invites] {current_user.email} created invite for {invite.email}")
    return result

@app.get("/invites/", response_model=list[schemas.UserInvite])
def get_invites(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin]))
):
    """Get list of all invites (Admin only)"""
    return crud.get_invites(db, skip=skip, limit=limit)

@app.delete("/invites/{invite_id}", response_model=schemas.UserInvite)
def delete_invite(
    invite_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([Role.Admin]))
):
    """Cancel/delete an invite (Admin only)"""
    result = crud.delete_invite(db, invite_id)
    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Invite not found"
        )
    logger.info(f"[invites] {current_user.email} deleted invite {invite_id}")
    return result
