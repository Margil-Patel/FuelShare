import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, ForeignKey, DateTime, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.fuel_share import FuelShare
    from app.models.user import User


class JoinRequest(Base):
    __tablename__ = "join_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    fuel_share_id: Mapped[int] = mapped_column(
        ForeignKey("fuel_shares.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="PENDING", nullable=False)
    requested_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    accepted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        UniqueConstraint("fuel_share_id", "user_id", name="uq_fuel_share_user_request"),
    )

    # Relationships
    fuel_share: Mapped["FuelShare"] = relationship("FuelShare", back_populates="join_requests")
    user: Mapped["User"] = relationship("User", back_populates="join_requests")

    def __repr__(self) -> str:
        return f"<JoinRequest id={self.id} trip_id={self.fuel_share_id} user_id={self.user_id} status='{self.status}'>"
