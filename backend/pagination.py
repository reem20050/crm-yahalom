"""
Pagination and filtering helpers.
"""
from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Query

T = TypeVar('T')


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response model"""
    data: List[T]
    total: int
    page: int
    limit: int
    has_next: bool
    has_prev: bool


def paginate_query(
    query: Query,
    skip: int = 0,
    limit: int = 20,
    max_limit: int = 100
) -> tuple[Query, int]:
    """
    Apply pagination to a query and return total count.
    
    Args:
        query: SQLAlchemy query
        skip: Number of records to skip
        limit: Number of records per page (will be capped at max_limit)
        max_limit: Maximum allowed limit
    
    Returns:
        Tuple of (paginated_query, total_count)
    """
    # Enforce maximum limit
    if limit > max_limit:
        limit = max_limit
    
    if limit < 1:
        limit = 20  # Default limit
    
    if skip < 0:
        skip = 0
    
    # Get total count before pagination
    total = query.count()
    
    # Apply pagination
    paginated_query = query.offset(skip).limit(limit)
    
    return paginated_query, total


def create_paginated_response(
    items: List[T],
    total: int,
    skip: int,
    limit: int
) -> PaginatedResponse[T]:
    """
    Create a paginated response object.
    
    Args:
        items: List of items for current page
        total: Total number of items
        skip: Number of items skipped
        limit: Number of items per page
    
    Returns:
        PaginatedResponse object
    """
    page = (skip // limit) + 1 if limit > 0 else 1
    has_next = (skip + limit) < total
    has_prev = skip > 0
    
    return PaginatedResponse(
        data=items,
        total=total,
        page=page,
        limit=limit,
        has_next=has_next,
        has_prev=has_prev
    )
