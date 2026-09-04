from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.matching import MatchListResponse
from app.services.matching import MatchingService

router = APIRouter(prefix="/matches", tags=["Matching Engine"])


@router.get(
    "/{fuel_share_id}",
    response_model=MatchListResponse,
    status_code=status.HTTP_200_OK,
    summary="Find Smart Matches for a Fuel Share",
)
def get_fuel_share_matches(
    fuel_share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Finds and ranks compatible active Fuel Share trips for the requested trip creator.

    Calculates compatibility scores (0-100%) based on route similarity (40%), departure time (25%),
    pickup proximity (20%), destination proximity (10%), and seat availability (5%).
    Filters out matches below the configured threshold.
    """
    return MatchingService.find_matches_for_trip(db, current_user, fuel_share_id)
