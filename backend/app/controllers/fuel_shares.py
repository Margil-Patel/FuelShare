import datetime
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.fuel_cost import FuelCostResponse
from app.schemas.fuel_share import FuelShareCreate, FuelShareResponse, FuelShareUpdate
from app.services.fuel_calculator import FuelCalculatorService
from app.services.fuel_share_service import FuelShareService

router = APIRouter(prefix="/fuel-shares", tags=["Fuel Shares"])


@router.post(
    "",
    response_model=FuelShareResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Fuel Share Trip",
)
def create_fuel_share(
    fuel_share_in: FuelShareCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates a new Fuel Share journey for the authenticated user."""
    return FuelShareService.create_fuel_share(db, current_user, fuel_share_in)


@router.get(
    "",
    response_model=list[FuelShareResponse],
    summary="List Available Fuel Shares",
)
def list_available_fuel_shares(
    source: str | None = Query(None, description="Filter by source location name"),
    destination: str | None = Query(None, description="Filter by destination location name"),
    departure_date: datetime.date | None = Query(None, description="Filter by departure date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    """Retrieves available ACTIVE Fuel Shares with optional basic search filters."""
    return FuelShareService.get_available_fuel_shares(
        db, source=source, destination=destination, departure_date=departure_date
    )


@router.get(
    "/{fuel_share_id}",
    response_model=FuelShareResponse,
    summary="Get Fuel Share Details by ID",
)
def get_fuel_share(
    fuel_share_id: int,
    db: Session = Depends(get_db),
):
    """Retrieves details of a specific Fuel Share trip."""
    return FuelShareService.get_fuel_share_by_id(db, fuel_share_id)


@router.get(
    "/{fuel_share_id}/cost",
    response_model=FuelCostResponse,
    summary="Get Fuel Cost and Savings Breakdown",
)
def get_fuel_share_cost(
    fuel_share_id: int,
    fuel_price: float | None = Query(None, description="Optional custom fuel price per litre"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Calculates fuel requirements, cost per participant, and estimated savings (creator and accepted participants only)."""
    return FuelCalculatorService.get_fuel_cost_breakdown(
        db, current_user, fuel_share_id, custom_fuel_price=fuel_price
    )


@router.put(
    "/{fuel_share_id}",
    response_model=FuelShareResponse,
    summary="Update Fuel Share Trip",
)
def update_fuel_share(
    fuel_share_id: int,
    fuel_share_in: FuelShareUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates attributes of a Fuel Share (creator only)."""
    return FuelShareService.update_fuel_share(db, current_user, fuel_share_id, fuel_share_in)


@router.delete(
    "/{fuel_share_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel / Delete Fuel Share Trip",
)
def delete_fuel_share(
    fuel_share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancels or deletes a Fuel Share trip (creator only)."""
    FuelShareService.delete_fuel_share(db, current_user, fuel_share_id)
    return None
