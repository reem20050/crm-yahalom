from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True) # Check validity if google auth is primary
    email = Column(String, unique=True, index=True) 
    hashed_password = Column(String, nullable=True) # Nullable for google auth users
    role = Column(String, default="admin") # admin, manager

class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String, index=True)
    last_name = Column(String, index=True)
    id_number = Column(String, unique=True, index=True)
    phone = Column(String)
    role = Column(String, default="guard") # guard, shift_manager
    start_date = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    address = Column(String)
    contact_person = Column(String)
    contact_phone = Column(String)
