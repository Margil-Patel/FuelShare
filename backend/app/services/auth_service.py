import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate


class AuthService:
    @staticmethod
    def register_user(db: Session, user_in: UserCreate) -> User:
        """Normalizes email, checks for existing user, hashes password, and creates new User."""
        normalized_email = user_in.email.strip().lower()

        existing_user = db.query(User).filter(User.email == normalized_email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User with this email already exists.",
            )

        hashed_pwd = hash_password(user_in.password)

        new_user = User(
            name=user_in.name.strip(),
            email=normalized_email,
            password_hash=hashed_pwd,
            phone=user_in.phone.strip() if user_in.phone else None,
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        return new_user

    @staticmethod
    def authenticate_user(db: Session, login_in: LoginRequest) -> TokenResponse:
        """Validates email & password, returning JWT access token on success."""
        normalized_email = login_in.email.strip().lower()

        user = db.query(User).filter(User.email == normalized_email).first()
        if not user or not verify_password(login_in.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        expires_delta = datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=expires_delta,
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
