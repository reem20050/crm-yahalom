"""
Input validation functions for data integrity.
"""
import re
from datetime import datetime


def validate_phone(phone: str) -> str:
    """
    Validate phone number format.
    Allows international formats with +, digits, spaces, dashes, parentheses.
    """
    if not phone:
        return phone
    
    # Remove whitespace for validation
    phone_clean = re.sub(r'\s+', '', phone)
    
    # Basic phone validation: digits, +, -, (), at least 7 digits
    if not re.match(r'^[\d\+\-\(\)]+$', phone_clean):
        raise ValueError('Invalid phone format. Use digits, +, -, or parentheses.')
    
    # Count digits
    digit_count = len(re.findall(r'\d', phone_clean))
    if digit_count < 7:
        raise ValueError('Phone number must contain at least 7 digits.')
    
    if digit_count > 15:
        raise ValueError('Phone number cannot exceed 15 digits.')
    
    return phone


def validate_id_number(id_number: str) -> str:
    """
    Validate ID number format.
    For Israeli ID numbers: 9 digits. Can be flexible for other formats.
    """
    if not id_number:
        return id_number
    
    # Remove whitespace and dashes
    id_clean = re.sub(r'[\s\-]+', '', id_number)
    
    # Check if all digits
    if not id_clean.isdigit():
        raise ValueError('ID number must contain only digits.')
    
    # Israeli ID is 9 digits
    if len(id_clean) != 9:
        raise ValueError('ID number must be exactly 9 digits.')
    
    return id_clean


def validate_email(email: str) -> str:
    """
    Basic email validation.
    More comprehensive validation can be added if needed.
    """
    if not email:
        raise ValueError('Email is required.')
    
    email = email.strip().lower()
    
    # Basic email regex
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        raise ValueError('Invalid email format.')
    
    # Length check
    if len(email) > 254:
        raise ValueError('Email address too long (max 254 characters).')
    
    return email


def validate_string_length(value: str, min_length: int = 0, max_length: int = None, field_name: str = "Field") -> str:
    """
    Validate string length.
    """
    if value is None:
        if min_length > 0:
            raise ValueError(f'{field_name} is required.')
        return value
    
    value = str(value).strip()
    
    if len(value) < min_length:
        raise ValueError(f'{field_name} must be at least {min_length} characters long.')
    
    if max_length and len(value) > max_length:
        raise ValueError(f'{field_name} cannot exceed {max_length} characters.')
    
    return value


def validate_shift_times(start_time: datetime, end_time: datetime):
    """
    Validate that shift end time is after start time.
    """
    if end_time <= start_time:
        raise ValueError('Shift end time must be after start time.')
    
    # Optional: Check if shift is not too long (e.g., max 24 hours)
    duration = end_time - start_time
    if duration.total_seconds() > 86400:  # 24 hours
        raise ValueError('Shift duration cannot exceed 24 hours.')
    
    if duration.total_seconds() < 0:
        raise ValueError('Shift end time must be after start time.')


def validate_role(role: str, allowed_roles: list[str]) -> str:
    """
    Validate that role is in the allowed list.
    """
    if role not in allowed_roles:
        raise ValueError(f'Invalid role. Allowed roles: {", ".join(allowed_roles)}')
    return role
