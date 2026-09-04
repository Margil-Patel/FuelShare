import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator


class VehicleBase(BaseModel):
    vehicle_type: str = Field(..., min_length=1, example="Sedan")
    fuel_type: str = Field(..., min_length=1, example="Petrol")
    mileage: float = Field(..., gt=0, example=16.5)
    seating_capacity: int = Field(..., gt=0, example=4)


class VehicleCreate(VehicleBase):
    @field_validator("vehicle_type", "fuel_type")
    @classmethod
    def validate_non_empty_string(cls, v: str) -> str:
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Field cannot be empty or whitespace only")
        return v_stripped


class VehicleUpdate(BaseModel):
    vehicle_type: str | None = Field(None, min_length=1, example="SUV")
    fuel_type: str | None = Field(None, min_length=1, example="Diesel")
    mileage: float | None = Field(None, gt=0, example=18.0)
    seating_capacity: int | None = Field(None, gt=0, example=5)

    @field_validator("vehicle_type", "fuel_type")
    @classmethod
    def validate_optional_non_empty_string(cls, v: str | None) -> str | None:
        if v is not None:
            v_stripped = v.strip()
            if not v_stripped:
                raise ValueError("Field cannot be empty or whitespace only")
            return v_stripped
        return v


class VehicleResponse(VehicleBase):
    id: int
    user_id: int
    created_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
