from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.vehicle import VehicleCreate, VehicleResponse, VehicleUpdate
from app.services.vehicle_service import VehicleService

router = APIRouter(prefix="/vehicles", tags=["Vehicles"])


@router.post(
    "",
    response_model=VehicleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Vehicle",
)
def create_vehicle(
    vehicle_in: VehicleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new vehicle for the authenticated user."""
    return VehicleService.create_vehicle(db, current_user, vehicle_in)


@router.get(
    "",
    response_model=list[VehicleResponse],
    summary="List User Vehicles",
)
def list_vehicles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves all vehicles owned by the authenticated user."""
    return VehicleService.get_user_vehicles(db, current_user)


@router.get(
    "/{vehicle_id}",
    response_model=VehicleResponse,
    summary="Get Vehicle by ID",
)
def get_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves a specific vehicle owned by the authenticated user."""
    return VehicleService.get_user_vehicle_by_id(db, current_user, vehicle_id)


@router.put(
    "/{vehicle_id}",
    response_model=VehicleResponse,
    summary="Update Vehicle",
)
def update_vehicle(
    vehicle_id: int,
    vehicle_in: VehicleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates attributes of a specific vehicle owned by the authenticated user."""
    return VehicleService.update_vehicle(db, current_user, vehicle_id, vehicle_in)


@router.delete(
    "/{vehicle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Vehicle",
)
def delete_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deletes a specific vehicle owned by the authenticated user."""
    VehicleService.delete_vehicle(db, current_user, vehicle_id)
    return None
