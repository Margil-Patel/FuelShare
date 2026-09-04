from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Any

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.impact import ImpactService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "",
    summary="Get User Impact Dashboard Metrics and Activity Feed",
)
def get_user_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Calculates personalized impact metrics (Money Saved, Fuel Saved, CO2 Reduced) and recent activity."""
    return ImpactService.get_user_dashboard_impact(db, current_user)
