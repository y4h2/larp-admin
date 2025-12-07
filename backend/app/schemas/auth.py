"""Authentication schemas."""

from datetime import datetime

from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Data extracted from JWT token."""

    user_id: str | None = None
    email: str | None = None


class LoginRequest(BaseModel):
    """Login request body."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User response schema."""

    id: str
    email: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    """Login response with token and user info."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse
