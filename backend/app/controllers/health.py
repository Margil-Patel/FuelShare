from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.health import HealthCheckResponse
from app.services.health_service import HealthService

router = APIRouter()


@router.get("/health", response_model=HealthCheckResponse, summary="System & Database Health Check")
def health_check(db: Session = Depends(get_db)):
    """Verifies system operational status and PostgreSQL database connection."""
    return HealthService.check_health(db)
