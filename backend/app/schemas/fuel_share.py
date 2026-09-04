import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class FuelShareStatus(str, Enum):
    ACTIVE = "ACTIVE"
    FULL = "FULL"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class FuelShareBase(BaseModel):
    source_name: str = Field(..., min_length=1, example="Ahmedabad Junction")
    source_latitude: float = Field(..., ge=-90.0, le=90.0, example=23.0225)
    source_longitude: float = Field(..., ge=-180.0, le=180.0, example=72.5714)
    destination_name: str = Field(..., min_length=1, example="Gandhinagar Bus Station")
    destination_latitude: float = Field(..., ge=-90.0, le=90.0, example=23.2156)
    destination_longitude: float = Field(..., ge=-180.0, le=180.0, example=72.6369)
    departure_date: datetime.date = Field(..., example="2026-08-25")
    departure_time: datetime.time = Field(..., example="09:00:00")
    available_seats: int = Field(..., ge=0, example=2)
    estimated_distance: float | None = Field(None, gt=0, example=28.5)
    estimated_fuel_cost: float | None = Field(None, ge=0, example=250.0)

    @field_validator("source_name", "destination_name")
    @classmethod
    def validate_non_empty_strings(cls, v: str) -> str:
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Location names cannot be empty or whitespace only")
        return v_stripped


class FuelShareCreate(FuelShareBase):
    @model_validator(mode="after")
    def validate_future_departure(self) -> "FuelShareCreate":
        dep_datetime = datetime.datetime.combine(self.departure_date, self.departure_time)
        now_dt = datetime.datetime.now()
        # Giving a 1-minute buffer for request latency
        if dep_datetime < (now_dt - datetime.timedelta(minutes=1)):
            raise ValueError("Departure date and time cannot be in the past")
        return self


class FuelShareUpdate(BaseModel):
    source_name: str | None = Field(None, min_length=1)
    source_latitude: float | None = Field(None, ge=-90.0, le=90.0)
    source_longitude: float | None = Field(None, ge=-180.0, le=180.0)
    destination_name: str | None = Field(None, min_length=1)
    destination_latitude: float | None = Field(None, ge=-90.0, le=90.0)
    destination_longitude: float | None = Field(None, ge=-180.0, le=180.0)
    departure_date: datetime.date | None = None
    departure_time: datetime.time | None = None
    available_seats: int | None = Field(None, gt=0)
    estimated_distance: float | None = Field(None, gt=0)
    estimated_fuel_cost: float | None = Field(None, ge=0)
    status: FuelShareStatus | None = None

    @field_validator("source_name", "destination_name")
    @classmethod
    def validate_optional_non_empty_strings(cls, v: str | None) -> str | None:
        if v is not None:
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("Location names cannot be empty or whitespace only")
            return v_stripped
        return v


class FuelShareResponse(FuelShareBase):
    id: int
    creator_id: int
    status: FuelShareStatus
    estimated_distance: float
    route_polyline: str | None = None
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
