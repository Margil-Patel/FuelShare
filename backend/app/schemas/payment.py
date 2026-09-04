import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class PaymentBase(BaseModel):
    fuel_share_id: int
    amount: float = Field(..., gt=0)


class PaymentCreate(PaymentBase):
    pass


class CreateOrderRequest(BaseModel):
    fuel_share_id: int = Field(..., example=1)


class CreateOrderResponse(BaseModel):
    order_id: str = Field(..., example="order_M123456789")
    amount_paise: int = Field(..., example=20000)
    amount_rupees: float = Field(..., example=200.0)
    currency: str = Field("INR", example="INR")
    key_id: str = Field(..., example="rzp_test_fuelshare123")
    payment_id: int = Field(..., example=1)


class PaymentVerifyRequest(BaseModel):
    razorpay_order_id: str = Field(..., example="order_M123456789")
    razorpay_payment_id: str = Field(..., example="pay_N987654321")
    razorpay_signature: str = Field(..., example="a1b2c3d4e5f6...")


class PaymentResponse(BaseModel):
    id: int
    user_id: int
    fuel_share_id: int
    amount: float
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    status: PaymentStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime

    model_config = ConfigDict(from_attributes=True)
