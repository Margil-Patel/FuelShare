from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="User Registration",
)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Registers a new user account with an Argon2 hashed password."""
    return AuthService.register_user(db, user_in)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="User Login",
)
def login(login_in: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates credentials and returns a JWT access token."""
    return AuthService.authenticate_user(db, login_in)
