"""Pydantic schemas for RideRequest API endpoints."""
import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, field_validator


class RideRequestStatusEnum(str, Enum):
    OPEN = "OPEN"
    MATCHED = "MATCHED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class RideRequestCreate(BaseModel):
    """Payload for POST /ride-requests."""

    pickup_name: str = Field(..., min_length=1, example="Bopal Cross Roads")
    pickup_latitude: float = Field(..., ge=-90.0, le=90.0, example=23.0225)
    pickup_longitude: float = Field(..., ge=-180.0, le=180.0, example=72.4716)
    drop_name: str = Field(..., min_length=1, example="SG Highway, Ahmedabad")
    drop_latitude: float = Field(..., ge=-90.0, le=90.0, example=23.0390)
    drop_longitude: float = Field(..., ge=-180.0, le=180.0, example=72.5062)
    desired_departure: datetime.datetime = Field(
        ..., example="2026-09-10T09:00:00"
    )
    seats_needed: int = Field(default=1, ge=1, le=8, example=1)

    @field_validator("pickup_name", "drop_name")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Location name cannot be empty.")
        return v


class RideRequestResponse(BaseModel):
    """Response body for RideRequest endpoints."""

    id: int
    passenger_id: int
    pickup_name: str
    pickup_latitude: float
    pickup_longitude: float
    drop_name: str
    drop_latitude: float
    drop_longitude: float
    desired_departure: datetime.datetime
    seats_needed: int
    status: RideRequestStatusEnum
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
