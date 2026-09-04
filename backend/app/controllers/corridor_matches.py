"""
FastAPI router for CorridorMatch endpoints.

Includes the rider view (find matching passengers for a ride) and
accept / reject actions.
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.corridor_match import (
    CorridorMatchListResponse,
    CorridorMatchResponse,
    CorridorMatchResultResponse,
)
from app.services.corridor_matching_service import CorridorMatchingService

router = APIRouter(tags=["Corridor Matches"])


# ---------------------------------------------------------------------------
# Rider view: matching passenger requests for a ride
# ---------------------------------------------------------------------------

@router.get(
    "/fuel-shares/{fuel_share_id}/corridor-matches",
    response_model=CorridorMatchListResponse,
    summary="Rider View — Find Matching Passenger Requests",
)
def get_corridor_matches_for_ride(
    fuel_share_id: int,
    buffer_m: int = Query(
        default=None,
        ge=50, le=5000,
        description="Buffer distance in meters",
    ),
    detour_max_km: float = Query(
        default=None,
        ge=0.0, le=50.0,
        description="Max absolute detour in km",
    ),
    detour_max_pct: float = Query(
        default=None,
        ge=0.0, le=1.0,
        description="Max proportional detour (0–1)",
    ),
    time_window_minutes: int = Query(
        default=None,
        ge=0, le=240,
        description="±minutes time window",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    **Rider view**: Given the authenticated rider's FuelShare (A→B), return all
    OPEN passenger requests (C→D) that fall within the route corridor in the
    correct travel order, within detour and time thresholds.

    Each result contains the passenger's pickup/drop lat-lng for map plotting,
    plus a fare estimate and detour cost.
    """
    eff_buffer = buffer_m if buffer_m is not None else settings.CORRIDOR_BUFFER_M
    eff_detour_km = detour_max_km if detour_max_km is not None else settings.CORRIDOR_DETOUR_MAX_KM
    eff_detour_pct = detour_max_pct if detour_max_pct is not None else settings.CORRIDOR_DETOUR_MAX_PCT
    eff_window = time_window_minutes

    results = CorridorMatchingService.find_corridor_matches_for_ride(
        db=db,
        current_user=current_user,
        fuel_share_id=fuel_share_id,
        buffer_m=eff_buffer,
        detour_max_km=eff_detour_km,
        detour_max_pct=eff_detour_pct,
        time_window_minutes=eff_window,
    )

    # Persist each result as a PROPOSED match (idempotent)
    for r in results:
        persisted = CorridorMatchingService.propose_corridor_match(db, r)
        r.match_id = persisted.id
        r.match_status = persisted.status

    match_responses = [
        CorridorMatchResultResponse(**r.__dict__)
        for r in results
    ]

    return CorridorMatchListResponse(
        total_matches=len(match_responses),
        buffer_m=eff_buffer,
        detour_max_km=eff_detour_km,
        time_window_minutes=eff_window,
        matches=match_responses,
    )


# ---------------------------------------------------------------------------
# Accept / reject a proposed corridor match
# ---------------------------------------------------------------------------

@router.post(
    "/corridor-matches/{match_id}/accept",
    response_model=CorridorMatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Accept a Corridor Match",
)
def accept_corridor_match(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Rider accepts a PROPOSED corridor match.

    - Decrements available_seats (row-locked to prevent double-booking).
    - Updates match status → ACCEPTED.
    - Updates ride_request status → MATCHED.
    - Returns the match record with a ``payment_hook`` placeholder that your
      Razorpay integration layer should read to initiate the payment order.
    """
    match = CorridorMatchingService.accept_corridor_match(db, current_user, match_id)

    # Build the payment hook interface
    payment_hook = {
        "fare_estimate_rupees": match.fare_estimate,
        "fuel_share_id": match.fuel_share_id,
        "ride_request_id": match.ride_request_id,
        "corridor_match_id": match.id,
        "action": "initiate_razorpay_order",
        "note": (
            "Call POST /payments/create-order with fuel_share_id to initiate payment. "
            "The fare_estimate_rupees here is the corridor-proportional amount."
        ),
    }

    # Return response with payment hook
    response_data = {
        "id": match.id,
        "fuel_share_id": match.fuel_share_id,
        "ride_request_id": match.ride_request_id,
        "detour_distance_m": match.detour_distance_m,
        "pickup_buffer_m": match.pickup_buffer_m,
        "drop_buffer_m": match.drop_buffer_m,
        "pickup_fraction": match.pickup_fraction,
        "drop_fraction": match.drop_fraction,
        "fare_estimate": match.fare_estimate,
        "fare_strategy": match.fare_strategy,
        "status": match.status,
        "created_at": match.created_at,
        "updated_at": match.updated_at,
        "payment_hook": payment_hook,
    }
    return CorridorMatchResponse(**response_data)


@router.post(
    "/corridor-matches/{match_id}/reject",
    response_model=CorridorMatchResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a Corridor Match",
)
def reject_corridor_match(
    match_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rider rejects a PROPOSED corridor match."""
    match = CorridorMatchingService.reject_corridor_match(db, current_user, match_id)
    return CorridorMatchResponse.model_validate(match)
