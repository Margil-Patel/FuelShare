import datetime
from pydantic import BaseModel, ConfigDict, Field


class MatchItemResponse(BaseModel):
    fuel_share_id: int = Field(..., example=15)
    creator_id: int = Field(..., example=2)
    match_score: int = Field(..., ge=0, le=100, example=94)
    reasons: list[str] = Field(
        ...,
        example=[
            "Same destination area",
            "Pickup locations are 2.1 km apart",
            "Departure time is within 10 minutes",
            "3 seats available",
        ],
    )
    pickup_distance_km: float = Field(..., example=2.1)
    destination_distance_km: float = Field(..., example=0.5)
    time_difference_minutes: int = Field(..., example=10)
    source_name: str = Field(..., example="Koramangala, Bengaluru")
    destination_name: str = Field(..., example="Indiranagar, Bengaluru")
    departure_date: datetime.date = Field(..., example="2026-08-25")
    departure_time: datetime.time = Field(..., example="09:30:00")
    available_seats: int = Field(..., example=3)
    estimated_fuel_cost: float = Field(..., example=120.0)

    model_config = ConfigDict(from_attributes=True)


class MatchListResponse(BaseModel):
    requested_fuel_share_id: int = Field(..., example=1)
    total_matches: int = Field(..., example=3)
    match_threshold: int = Field(..., example=60)
    matches: list[MatchItemResponse]
