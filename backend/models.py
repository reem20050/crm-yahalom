from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True) # Check validity if google auth is primary
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True) # Nullable for google auth users
    role = Column(String, default="Guard")  # Admin, OperationsManager, Scheduler, Sales, Finance, ShiftLead, Guard
    tasks_assigned = relationship("Task", foreign_keys="Task.assigned_to", back_populates="assigned_user")
    tasks_created = relationship("Task", foreign_keys="Task.created_by", back_populates="creator")
    notifications = relationship("Notification", back_populates="user")

class AllowedEmail(Base):
    __tablename__ = "allowed_emails"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    added_by = Column(String, nullable=True)  # Email of admin who added this
    added_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(String, nullable=True)  # Optional notes about this user


class UserInvite(Base):
    __tablename__ = "user_invites"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, default="Guard")  # Role to assign when user accepts
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # Admin who created invite
    token = Column(String, unique=True, index=True, nullable=False)  # Unique invite token
    expires_at = Column(DateTime, nullable=False)  # Invite expiration date
    accepted_at = Column(DateTime, nullable=True)  # When invite was accepted
    created_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(String, nullable=True)  # Optional notes

    inviter = relationship("User", foreign_keys=[invited_by])

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, index=True)
    last_name = Column(String, index=True)
    id_number = Column(String, unique=True, index=True)
    phone = Column(String)
    email = Column(String, nullable=True, index=True)
    role = Column(String, default="guard") # guard, shift_manager
    base_pay = Column(String, nullable=True)  # Using String to avoid decimal precision issues
    availability = Column(String, nullable=True)  # JSON string for weekly schedule
    start_date = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    shifts = relationship("Shift", back_populates="employee")
    certifications = relationship("EmployeeCertification", back_populates="employee", cascade="all, delete-orphan")
    files = relationship("EmployeeFile", back_populates="employee", cascade="all, delete-orphan")

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    address = Column(String)
    contact_person = Column(String)
    contact_phone = Column(String)
    email = Column(String, nullable=True, index=True)
    notes = Column(Text, nullable=True)
    contacts = Column(JSON, nullable=True)  # JSON array of contact objects
    sites = Column(JSON, nullable=True)  # JSON array of site objects
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    shifts = relationship("Shift", back_populates="client")
    files = relationship("ClientFile", back_populates="client", cascade="all, delete-orphan")

class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    status = Column(String, default="scheduled") # scheduled, completed, canceled
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="shifts")
    client = relationship("Client", back_populates="shifts")

class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    due_date = Column(DateTime, nullable=True)
    status = Column(String, default="open") # open, in_progress, done
    priority = Column(String, default="normal") # low, normal, high
    created_at = Column(DateTime, default=datetime.utcnow)

    assigned_user = relationship("User", foreign_keys=[assigned_to], back_populates="tasks_assigned")
    creator = relationship("User", foreign_keys=[created_by], back_populates="tasks_created")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    notif_type = Column(String, default="info") # info, warning, success
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="notifications")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String, index=True)  # Correlation ID from middleware
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    actor_email = Column(String, index=True)  # Email for easier debugging
    action = Column(String, nullable=False, index=True)  # create, update, delete, role_change
    resource_type = Column(String, nullable=False, index=True)  # user, employee, client, shift, task
    resource_id = Column(Integer, index=True)
    old_value = Column(String, nullable=True)  # JSON string
    new_value = Column(String, nullable=True)  # JSON string
    success = Column(Boolean, default=True)
    error_message = Column(String, nullable=True)
    ip_address = Column(String)
    user_agent = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User")


class EmployeeCertification(Base):
    __tablename__ = "employee_certifications"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    name = Column(String, nullable=False)  # e.g., "Security Guard License", "First Aid"
    issuer = Column(String, nullable=True)  # Issuing organization
    issued_date = Column(DateTime, nullable=True)
    expiry_date = Column(DateTime, nullable=True, index=True)  # Indexed for expiry queries
    certificate_number = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    employee = relationship("Employee", back_populates="certifications")


class ClientFile(Base):
    __tablename__ = "client_files"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)  # Path on filesystem or S3 key
    file_size = Column(Integer, nullable=False)  # Size in bytes
    file_type = Column(String, nullable=True)  # MIME type
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("Client")
    uploader = relationship("User")


class EmployeeFile(Base):
    __tablename__ = "employee_files"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    file_type = Column(String, nullable=True)
    document_type = Column(String, nullable=True)  # ID Copy, Contract, Certificate, Other
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee")
    uploader = relationship("User")
