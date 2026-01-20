<<<<<<< HEAD
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from validators import (
    validate_phone,
    validate_id_number,
    validate_email,
    validate_string_length,
    validate_shift_times
)
=======
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95

class Token(BaseModel):
    access_token: str
    token_type: str

class GoogleLogin(BaseModel):
<<<<<<< HEAD
    credential: str  # JWT credential from Google Identity Services (not token)

# --- User Schemas ---
class UserBase(BaseModel):
    username: Optional[str] = None
=======
    token: str

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
    role: Optional[str] = "admin"

class UserCreate(UserBase):
    password: str

<<<<<<< HEAD
class UserOut(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    role: Optional[str] = "user"

    class Config:
        from_attributes = True
=======
class User(UserBase):
    id: int
    class Config:
        orm_mode = True

class UserOut(BaseModel):
    id: int
    email: str
    role: Optional[str] = "user"

    class Config:
        orm_mode = True
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95

class UserRoleUpdate(BaseModel):
    role: str

<<<<<<< HEAD
# --- Allowed Email Schemas ---
class AllowedEmailBase(BaseModel):
    email: str
    notes: Optional[str] = None
    
    @validator('email')
    def validate_allowed_email(cls, v):
        return validate_email(v)

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
    
    @validator('email')
    def validate_invite_email(cls, v):
        return validate_email(v)
    
    @validator('role')
    def validate_invite_role(cls, v):
        allowed = ["Admin", "OperationsManager", "Scheduler", "Sales", "Finance", "ShiftLead", "Guard"]
        if v not in allowed:
            raise ValueError(f'Invalid role. Allowed: {", ".join(allowed)}')
        return v

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

=======
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
# --- Employee Schemas ---
class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    id_number: str
    phone: Optional[str] = None
    role: Optional[str] = "guard"
    is_active: Optional[bool] = True
<<<<<<< HEAD
    
    @validator('first_name')
    def validate_first_name(cls, v):
        return validate_string_length(v, min_length=1, max_length=100, field_name="First name")
    
    @validator('last_name')
    def validate_last_name(cls, v):
        return validate_string_length(v, min_length=1, max_length=100, field_name="Last name")
    
    @validator('id_number')
    def validate_id_number_field(cls, v):
        return validate_id_number(v)
    
    @validator('phone')
    def validate_phone_field(cls, v):
        if v:
            return validate_phone(v)
        return v
    
    @validator('role')
    def validate_employee_role(cls, v):
        allowed = ["guard", "shift_manager"]
        if v not in allowed:
            raise ValueError(f'Invalid employee role. Allowed: {", ".join(allowed)}')
        return v
=======
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95

class EmployeeCreate(EmployeeBase):
    pass

class Employee(EmployeeBase):
    id: int
    start_date: datetime
<<<<<<< HEAD

    class Config:
        from_attributes = True
=======
    class Config:
        orm_mode = True
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95

# --- Client Schemas ---
class ClientBase(BaseModel):
    name: str
    address: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
<<<<<<< HEAD
    email: Optional[str] = None
    notes: Optional[str] = None
    
    @validator('name')
    def validate_name(cls, v):
        return validate_string_length(v, min_length=1, max_length=200, field_name="Client name")
    
    @validator('address')
    def validate_address(cls, v):
        if v:
            return validate_string_length(v, min_length=0, max_length=500, field_name="Address")
        return v
    
    @validator('contact_person')
    def validate_contact_person(cls, v):
        if v:
            return validate_string_length(v, min_length=1, max_length=100, field_name="Contact person")
        return v
    
    @validator('contact_phone')
    def validate_contact_phone(cls, v):
        if v:
            return validate_phone(v)
        return v
    
    @validator('email')
    def validate_email_field(cls, v):
        if v:
            return validate_email(v)
        return v
    
    @validator('notes')
    def validate_notes(cls, v):
        if v:
            return validate_string_length(v, min_length=0, max_length=5000, field_name="Notes")
        return v
=======
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95

class ClientCreate(ClientBase):
    pass

class Client(ClientBase):
    id: int
<<<<<<< HEAD
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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
    
    @validator('status')
    def validate_status(cls, v):
        allowed = ["scheduled", "completed", "canceled"]
        if v not in allowed:
            raise ValueError(f'Invalid shift status. Allowed: {", ".join(allowed)}')
        return v
    
    @validator('notes')
    def validate_notes(cls, v):
        if v:
            return validate_string_length(v, min_length=0, max_length=1000, field_name="Notes")
        return v
    
    @validator('end_time')
    def validate_end_after_start(cls, v, values):
        if 'start_time' in values:
            validate_shift_times(values['start_time'], v)
        return v

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

# --- Audit Log Schemas ---
class AuditLogBase(BaseModel):
    request_id: Optional[str] = None
    user_id: Optional[int] = None
    actor_email: Optional[str] = None
    action: str
    resource_type: str
    resource_id: int
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    success: bool
    error_message: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

class AuditLog(AuditLogBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
=======
    class Config:
        orm_mode = True
>>>>>>> 18fb827a42f32e1cfab7217344b5bd49a54c6c95
