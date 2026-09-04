"""RideRequest SQLAlchemy model — a passenger's desired pickup/drop request."""
import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.corridor_match import CorridorMatch


class RideRequest(Base):
    """Represents a passenger's desired ride: pickup point C → drop point D."""

    __tablename__ = "ride_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    passenger_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Pickup point C
    pickup_name: Mapped[str] = mapped_column(String(255), nullable=False)
    pickup_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_longitude: Mapped[float] = mapped_column(Float, nullable=False)

    # Drop point D
    drop_name: Mapped[str] = mapped_column(String(255), nullable=False)
    drop_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    drop_longitude: Mapped[float] = mapped_column(Float, nullable=False)

    # Desired departure datetime (combined for easy comparison)
    desired_departure: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=False), nullable=False
    )

    seats_needed: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Status lifecycle: OPEN → MATCHED / EXPIRED / CANCELLED
    status: Mapped[str] = mapped_column(String(20), default="OPEN", nullable=False)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    passenger: Mapped["User"] = relationship("User", back_populates="ride_requests")
    corridor_matches: Mapped[list["CorridorMatch"]] = relationship(
        "CorridorMatch", back_populates="ride_request", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<RideRequest id={self.id} "
            f"passenger_id={self.passenger_id} "
            f"from='{self.pickup_name}' to='{self.drop_name}' "
            f"status='{self.status}'>"
        )
