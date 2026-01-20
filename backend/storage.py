"""
File storage abstraction layer.
Supports local filesystem storage (can be extended to S3/cloud storage later).
"""
import os
import uuid
from pathlib import Path
from typing import BinaryIO, Tuple
import shutil

# Configuration
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB default
ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.txt', '.xls', '.xlsx'}


def ensure_upload_dirs():
    """Ensure upload directories exist."""
    client_dir = Path(UPLOAD_DIR) / "clients"
    employee_dir = Path(UPLOAD_DIR) / "employees"
    client_dir.mkdir(parents=True, exist_ok=True)
    employee_dir.mkdir(parents=True, exist_ok=True)
    return client_dir, employee_dir


def get_file_extension(filename: str) -> str:
    """Get file extension from filename."""
    return Path(filename).suffix.lower()


def is_allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return get_file_extension(filename) in ALLOWED_EXTENSIONS


def validate_file_size(file_size: int) -> bool:
    """Validate file size is within limits."""
    return file_size <= MAX_FILE_SIZE


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename to avoid collisions."""
    ext = get_file_extension(original_filename)
    unique_id = str(uuid.uuid4())
    return f"{unique_id}{ext}"


def save_file(file: BinaryIO, resource_type: str, resource_id: int, original_filename: str) -> Tuple[str, int]:
    """
    Save uploaded file to disk.
    
    Args:
        file: File object to save
        resource_type: 'client' or 'employee'
        resource_id: ID of the resource
        original_filename: Original filename from upload
    
    Returns:
        Tuple of (file_path, file_size)
    """
    if resource_type not in ['client', 'employee']:
        raise ValueError(f"Invalid resource_type: {resource_type}")
    
    # Validate file extension
    if not is_allowed_file(original_filename):
        raise ValueError(f"File type not allowed. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Ensure directories exist
    client_dir, employee_dir = ensure_upload_dirs()
    
    # Choose directory based on resource type
    base_dir = client_dir if resource_type == 'client' else employee_dir
    
    # Create subdirectory for resource
    resource_dir = base_dir / str(resource_id)
    resource_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    unique_filename = generate_unique_filename(original_filename)
    file_path = resource_dir / unique_filename
    
    # Save file and get size
    file_size = 0
    with open(file_path, 'wb') as f:
        # Read file in chunks to handle large files
        while True:
            chunk = file.read(8192)  # 8KB chunks
            if not chunk:
                break
            file_size += len(chunk)
            f.write(chunk)
    
    # Validate file size
    if not validate_file_size(file_size):
        # Delete file if too large
        os.remove(file_path)
        raise ValueError(f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB")
    
    # Return relative path from UPLOAD_DIR
    relative_path = str(file_path.relative_to(UPLOAD_DIR))
    return relative_path, file_size


def get_file_path(relative_path: str) -> Path:
    """Get absolute path from relative path."""
    return Path(UPLOAD_DIR) / relative_path


def delete_file(relative_path: str) -> bool:
    """Delete file from disk."""
    try:
        file_path = get_file_path(relative_path)
        if file_path.exists():
            os.remove(file_path)
            return True
        return False
    except Exception:
        return False


def get_mime_type(filename: str) -> str:
    """Get MIME type from filename."""
    ext = get_file_extension(filename).lower()
    mime_types = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.txt': 'text/plain',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }
    return mime_types.get(ext, 'application/octet-stream')
