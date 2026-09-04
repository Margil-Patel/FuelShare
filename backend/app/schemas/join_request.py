import datetime
from enum import Enum
from pydantic import BaseModel, EmailStr, ConfigDict
from app.schemas.fuel_share import FuelShareResponse


class JoinRequestStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class UserPublic(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str | None = None

    model_config = ConfigDict(from_attributes=True)


class JoinRequestBase(BaseModel):
    fuel_share_id: int | None = None


class JoinRequestCreate(JoinRequestBase):
    pass


class JoinRequestResponse(BaseModel):
    id: int
    fuel_share_id: int
    user_id: int
    user: UserPublic | None = None
    fuel_share: FuelShareResponse | None = None
    status: JoinRequestStatus
    requested_at: datetime.datetime
    accepted_at: datetime.datetime | None = None
    fare_amount: float | None = None
    pickup_name: str | None = None
    drop_name: str | None = None
    payment_status: str | None = None
    is_paid: bool = False

    model_config = ConfigDict(from_attributes=True)


class JoinRequestListResponse(BaseModel):
    total: int
    requests: list[JoinRequestResponse]
