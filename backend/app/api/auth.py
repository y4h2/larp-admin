"""Authentication API endpoints."""

from datetime import timedelta

from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.database import DBSession
from app.dependencies.auth import CurrentUser
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse
from app.services.auth import authenticate_user, create_access_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: DBSession) -> LoginResponse:
    """
    Authenticate user and return JWT token.

    Args:
        request: Login credentials (email and password)
        db: Database session

    Returns:
        JWT access token and user info

    Raises:
        HTTPException: If credentials are invalid
    """
    user = await authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.jwt_expire_minutes)
    access_token = create_access_token(
        data={"sub": user.id, "email": user.email},
        expires_delta=access_token_expires,
    )

    return LoginResponse(
        access_token=access_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: CurrentUser) -> UserResponse:
    """
    Get current authenticated user info.

    Args:
        current_user: Current authenticated user

    Returns:
        User information
    """
    return UserResponse.model_validate(current_user)
