from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class GoogleLogin(BaseModel):
    credential: str  # JWT credential from Google Identity Services (not token)

# --- User Schemas ---
class UserBase(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = "admin"

class UserCreate(UserBase):
    password: str

class UserOut(BaseModel):
    id: int
    email: str
    role: Optional[str] = "user"

    class Config:
        from_attributes = True

class UserRoleUpdate(BaseModel):
    role: str

# --- Allowed Email Schemas ---
class AllowedEmailBase(BaseModel):
    email: str
    notes: Optional[str] = None

class AllowedEmailCreate(AllowedEmailBase):
    pass

class AllowedEmail(AllowedEmailBase):
    id: int
    added_by: Optional[str] = None
    added_at: datetime

    class Config:
        from_attributes = True

# --- User Invite Schemas ---
class UserInviteBase(BaseModel):
    email: str
    role: str = "Guard"
    notes: Optional[str] = None

class UserInviteCreate(UserInviteBase):
    pass

class UserInvite(UserInviteBase):
    id: int
    invited_by: Optional[int] = None
    token: str
    expires_at: datetime
    accepted_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Employee Schemas ---
class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    id_number: str
    phone: Optional[str] = None
    role: Optional[str] = "guard"
    is_active: Optional[bool] = True

class EmployeeCreate(EmployeeBase):
    pass

class Employee(EmployeeBase):
    id: int
    start_date: datetime

    class Config:
        from_attributes = True

# --- Client Schemas ---
class ClientBase(BaseModel):
    name: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None

class ClientCreate(ClientBase):
    pass

class Client(ClientBase):
    id: int

    class Config:
        from_attributes = True

# --- Shift Schemas ---
class ShiftBase(BaseModel):
    employee_id: int
    client_id: Optional[int] = None
    start_time: datetime
    end_time: datetime
    status: Optional[str] = "scheduled"
    notes: Optional[str] = None

class ShiftCreate(ShiftBase):
    pass

class Shift(ShiftBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Task Schemas ---
class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to: Optional[int] = None
    due_date: Optional[datetime] = None
    status: Optional[str] = "open"
    priority: Optional[str] = "normal"

class TaskCreate(TaskBase):
    pass

class Task(TaskBase):
    id: int
    created_by: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

# --- Notification Schemas ---
class NotificationBase(BaseModel):
    title: str
    message: str
    notif_type: Optional[str] = "info"

class NotificationCreate(NotificationBase):
    user_id: int

class Notification(NotificationBase):
    id: int
    user_id: int
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Report Schemas ---
class ShiftReport(BaseModel):
    total_shifts: int
    scheduled_shifts: int
    completed_shifts: int
    canceled_shifts: int

class EmployeeReportItem(BaseModel):
    employee_id: int
    employee_name: str
    total_shifts: int
    active_shifts: int

class EmployeeReport(BaseModel):
    total_employees: int
    items: list[EmployeeReportItem]
