from fastapi import APIRouter
from app.schemas.health import RootResponse
from app.services.health_service import HealthService

router = APIRouter()


@router.get("/", response_model=RootResponse, summary="API Root Endpoint")
def read_root():
    """Returns basic message confirming Fuel Share API is active."""
    return HealthService.get_root_info()
