from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.payment import (
    CreateOrderRequest,
    CreateOrderResponse,
    PaymentResponse,
    PaymentVerifyRequest,
)
from app.services.payment import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post(
    "/create-order",
    response_model=CreateOrderResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Razorpay Order for Fuel Share Contribution",
)
def create_payment_order(
    request: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Calculates participant contribution and creates a Razorpay order."""
    return PaymentService.create_payment_order(db, current_user, request.fuel_share_id)


@router.post(
    "/verify",
    response_model=PaymentResponse,
    summary="Verify Razorpay Payment HMAC Signature",
)
def verify_payment(
    request: PaymentVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cryptographically verifies payment signature and updates payment status to SUCCESS."""
    return PaymentService.verify_payment_signature(db, current_user, request)


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
    summary="Get Payment Record Details",
)
def get_payment_details(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves payment status and record for authorized user."""
    return PaymentService.get_payment_by_id(db, current_user, payment_id)


@router.get(
    "/fuel-shares/{fuel_share_id}",
    response_model=PaymentResponse | None,
    summary="Get Current User Payment Status for a Trip",
)
def get_trip_payment_status(
    fuel_share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns payment status for the logged in user for a specific trip."""
    return PaymentService.get_trip_payment_status(db, current_user, fuel_share_id)
