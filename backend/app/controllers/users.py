from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.fuel_share import FuelShareResponse
from app.schemas.user import UserResponse, UserUpdate
from app.services.fuel_share_service import FuelShareService
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get Current Authenticated User Profile",
)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns safe user profile details for the logged-in user."""
    return current_user


@router.put(
    "/me",
    response_model=UserResponse,
    summary="Update User Profile",
)
def update_me(
    user_in: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates basic profile information (name, phone) for the authenticated user."""
    return UserService.update_user_profile(db, current_user, user_in)


@router.get(
    "/me/fuel-shares",
    response_model=list[FuelShareResponse],
    summary="Get Fuel Shares Created by Current User",
)
def get_my_fuel_shares(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all Fuel Share trips created by the logged-in user."""
    return FuelShareService.get_user_fuel_shares(db, current_user)
