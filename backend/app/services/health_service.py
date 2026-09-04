from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.config import settings
from app.schemas.health import HealthCheckResponse, DatabaseHealth, RootResponse


class HealthService:
    @staticmethod
    def get_root_info() -> RootResponse:
        return RootResponse(
            message="Fuel Share API is running smoothly.",
            app_name=settings.APP_NAME,
            environment=settings.APP_ENV,
        )

    @staticmethod
    def check_health(db: Session) -> HealthCheckResponse:
        db_connected = False
        db_details = ""
        try:
            db.execute(text("SELECT 1"))
            db_connected = True
            db_details = "Successfully connected to primary database."
        except Exception as e:
            db_connected = False
            db_details = f"Database connection error: {str(e)}"

        status = "healthy" if db_connected else "unhealthy"

        return HealthCheckResponse(
            status=status,
            app_name=settings.APP_NAME,
            environment=settings.APP_ENV,
            database=DatabaseHealth(
                connected=db_connected,
                details=db_details,
            ),
        )
