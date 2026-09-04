import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

if TYPE_CHECKING:
    from app.models.vehicle import Vehicle
    from app.models.fuel_share import FuelShare
    from app.models.join_request import JoinRequest
    from app.models.payment import Payment
    from app.models.ride_request import RideRequest


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    vehicles: Mapped[list["Vehicle"]] = relationship(
        "Vehicle", back_populates="user", cascade="all, delete-orphan"
    )
    created_fuel_shares: Mapped[list["FuelShare"]] = relationship(
        "FuelShare", back_populates="creator", cascade="all, delete-orphan"
    )
    join_requests: Mapped[list["JoinRequest"]] = relationship(
        "JoinRequest", back_populates="user", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(
        "Payment", back_populates="user", cascade="all, delete-orphan"
    )
    ride_requests: Mapped[list["RideRequest"]] = relationship(
        "RideRequest", back_populates="passenger", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email='{self.email}'>"
