"""CorridorMatch SQLAlchemy model — links a FuelShare ride to a matching RideRequest."""
import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.fuel_share import FuelShare
    from app.models.ride_request import RideRequest


class CorridorMatch(Base):
    """
    Persists the result of a corridor-matching evaluation between a FuelShare
    ride (A→B) and a RideRequest (C→D).

    Status lifecycle:
        PROPOSED  → match computed but neither party has acted
        ACCEPTED  → rider accepted the passenger → triggers payment hook
        REJECTED  → rider rejected the passenger request
        EXPIRED   → match auto-expired (ride departed / request cancelled)
    """

    __tablename__ = "corridor_matches"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    fuel_share_id: Mapped[int] = mapped_column(
        ForeignKey("fuel_shares.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ride_request_id: Mapped[int] = mapped_column(
        ForeignKey("ride_requests.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Corridor matching metrics
    detour_distance_m: Mapped[float] = mapped_column(Float, nullable=False)
    pickup_buffer_m: Mapped[float] = mapped_column(
        Float, nullable=False, comment="Distance from pickup C to route polyline (m)"
    )
    drop_buffer_m: Mapped[float] = mapped_column(
        Float, nullable=False, comment="Distance from drop D to route polyline (m)"
    )
    pickup_fraction: Mapped[float] = mapped_column(
        Float, nullable=False, comment="Linear location of C on route [0-1]"
    )
    drop_fraction: Mapped[float] = mapped_column(
        Float, nullable=False, comment="Linear location of D on route [0-1]"
    )

    # Fare estimate (pluggable calculation result)
    fare_estimate: Mapped[float] = mapped_column(Float, nullable=False)
    fare_strategy: Mapped[str] = mapped_column(
        String(20), default="proportional", nullable=False
    )

    status: Mapped[str] = mapped_column(String(20), default="PROPOSED", nullable=False)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    fuel_share: Mapped["FuelShare"] = relationship("FuelShare", back_populates="corridor_matches")
    ride_request: Mapped["RideRequest"] = relationship("RideRequest", back_populates="corridor_matches")

    def __repr__(self) -> str:
        return (
            f"<CorridorMatch id={self.id} "
            f"ride={self.fuel_share_id} request={self.ride_request_id} "
            f"fare=₹{self.fare_estimate:.2f} status='{self.status}'>"
        )
