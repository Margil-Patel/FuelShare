import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Float, Integer, Date, Time, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.join_request import JoinRequest
    from app.models.payment import Payment
    from app.models.corridor_match import CorridorMatch


class FuelShare(Base):
    __tablename__ = "fuel_shares"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    creator_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    source_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    destination_name: Mapped[str] = mapped_column(String(255), nullable=False)
    destination_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    destination_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    departure_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    departure_time: Mapped[datetime.time] = mapped_column(Time, nullable=False)
    available_seats: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_distance: Mapped[float] = mapped_column(Float, nullable=False)
    estimated_fuel_cost: Mapped[float] = mapped_column(Float, nullable=False)
    route_polyline: Mapped[str | None] = mapped_column(
        String(65535), nullable=True,
        comment="OSRM-encoded polyline for the driving route A→B"
    )
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="created_fuel_shares")
    join_requests: Mapped[list["JoinRequest"]] = relationship(
        "JoinRequest", back_populates="fuel_share", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="fuel_share", cascade="all, delete-orphan"
    )
    corridor_matches: Mapped[list["CorridorMatch"]] = relationship(
        "CorridorMatch", back_populates="fuel_share", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<FuelShare id={self.id} from='{self.source_name}' to='{self.destination_name}' status='{self.status}'>"
