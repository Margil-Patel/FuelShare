"""Pydantic schemas for CorridorMatch API endpoints."""
import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class CorridorMatchStatusEnum(str, Enum):
    PROPOSED = "PROPOSED"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"


class CorridorMatchResultResponse(BaseModel):
    """
    A single corridor match result — used in both passenger search
    (GET /ride-requests/{id}/corridor-matches) and rider view
    (GET /fuel-shares/{id}/corridor-matches).
    """
    fuel_share_id: int = Field(..., example=7)
    ride_request_id: int = Field(..., example=3)
    driver_id: int = Field(..., example=2)

    # Route info
    source_name: str = Field(..., example="Ahmedabad Junction")
    destination_name: str = Field(..., example="Gandhinagar Bus Station")
    departure_datetime: datetime.datetime = Field(..., example="2026-09-10T09:00:00")
    available_seats: int = Field(..., example=2)
    total_route_km: float = Field(..., example=28.5)
    route_polyline: str | None = Field(None, description="Encoded route polyline for map rendering")

    # Corridor metrics
    pickup_buffer_m: float = Field(..., example=312.4, description="Distance from pickup C to route (m)")
    drop_buffer_m: float = Field(..., example=198.7, description="Distance from drop D to route (m)")
    pickup_fraction: float = Field(..., ge=0, le=1, example=0.18, description="C location along route [0-1]")
    drop_fraction: float = Field(..., ge=0, le=1, example=0.74, description="D location along route [0-1]")
    detour_distance_m: float = Field(..., example=480.0, description="Extra distance driver incurs (m)")

    # Fare
    fare_estimate: float = Field(..., example=87.50, description="Estimated fare for the passenger (₹)")
    fare_strategy: str = Field(..., example="proportional")

    # Passenger point info (present in rider view)
    passenger_id: int | None = None
    pickup_name: str = Field(default="", example="Bopal Cross Roads")
    drop_name: str = Field(default="", example="SG Highway")
    seats_needed: int = Field(default=1, example=1)
    pickup_latitude: float = Field(default=0.0)
    pickup_longitude: float = Field(default=0.0)
    drop_latitude: float = Field(default=0.0)
    drop_longitude: float = Field(default=0.0)
    desired_departure: datetime.datetime | None = None

    # Persisted match info (populated after propose_corridor_match)
    match_id: int | None = None
    match_status: str = Field(default="PROPOSED")


class CorridorMatchListResponse(BaseModel):
    """Response wrapper for corridor match lists."""
    total_matches: int
    buffer_m: int = Field(..., description="Buffer distance used (m)")
    detour_max_km: float
    time_window_minutes: int | None = None
    matches: list[CorridorMatchResultResponse]


class CorridorMatchResponse(BaseModel):
    """Response for a single persisted CorridorMatch record (accept / reject)."""
    id: int
    fuel_share_id: int
    ride_request_id: int
    detour_distance_m: float
    pickup_buffer_m: float
    drop_buffer_m: float
    pickup_fraction: float
    drop_fraction: float
    fare_estimate: float
    fare_strategy: str
    status: CorridorMatchStatusEnum
    created_at: datetime.datetime
    updated_at: datetime.datetime

    # Payment hook: populated on ACCEPTED status
    payment_hook: dict | None = Field(
        None,
        description=(
            "Placeholder for Razorpay integration. "
            "Contains fare_estimate and ride/request IDs for payment initiation."
        ),
        example={
            "fare_estimate_rupees": 87.50,
            "fuel_share_id": 7,
            "ride_request_id": 3,
            "action": "initiate_razorpay_order",
        },
    )

    model_config = ConfigDict(from_attributes=True)
