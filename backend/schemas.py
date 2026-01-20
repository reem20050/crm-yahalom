from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class GoogleLogin(BaseModel):
    token: str

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
    role: Optional[str] = "admin"

class UserCreate(UserBase):
    password: str

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

class UserRoleUpdate(BaseModel):
    role: str

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
        orm_mode = True

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
        orm_mode = True
