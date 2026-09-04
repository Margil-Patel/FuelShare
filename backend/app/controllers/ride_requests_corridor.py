"""
FastAPI router for RideRequest endpoints.

Passenger-facing endpoints for corridor-based ride matching.
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.ride_request import RideRequestCreate, RideRequestResponse
from app.schemas.corridor_match import CorridorMatchListResponse, CorridorMatchResultResponse
from app.services.ride_request_service import RideRequestService
from app.services.corridor_matching_service import CorridorMatchingService
from app.core.config import settings

router = APIRouter(prefix="/ride-requests", tags=["Ride Requests (Corridor Matching)"])


@router.post(
    "",
    response_model=RideRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a Passenger Ride Request",
)
def create_ride_request(
    body: RideRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submit a passenger's desired pickup (C) and drop (D) as a ride request.
    The corridor matching engine will evaluate this request against active rides.
    """
    return RideRequestService.create_ride_request(
        db=db,
        current_user=current_user,
        pickup_name=body.pickup_name,
        pickup_latitude=body.pickup_latitude,
        pickup_longitude=body.pickup_longitude,
        drop_name=body.drop_name,
        drop_latitude=body.drop_latitude,
        drop_longitude=body.drop_longitude,
        desired_departure=body.desired_departure,
        seats_needed=body.seats_needed,
    )


@router.get(
    "/me",
    response_model=list[RideRequestResponse],
    summary="Get My Ride Requests",
)
def get_my_ride_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all ride requests submitted by the current passenger."""
    return RideRequestService.get_my_ride_requests(db, current_user)


@router.get(
    "/{request_id}",
    response_model=RideRequestResponse,
    summary="Get Ride Request Details",
)
def get_ride_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a specific ride request by ID."""
    return RideRequestService.get_ride_request_by_id(db, request_id)


@router.delete(
    "/{request_id}",
    response_model=RideRequestResponse,
    summary="Cancel a Ride Request",
)
def cancel_ride_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel an OPEN ride request (passenger only)."""
    return RideRequestService.cancel_ride_request(db, current_user, request_id)


@router.get(
    "/{request_id}/corridor-matches",
    response_model=CorridorMatchListResponse,
    summary="Find Corridor-Matched Rides for a Passenger Request",
)
def get_corridor_matches_for_request(
    request_id: int,
    buffer_m: int = Query(
        default=None,
        ge=50, le=5000,
        description="Buffer distance in meters (default: CORRIDOR_BUFFER_M from config)",
    ),
    detour_max_km: float = Query(
        default=None,
        ge=0.0, le=50.0,
        description="Max absolute detour in km (default: CORRIDOR_DETOUR_MAX_KM from config)",
    ),
    detour_max_pct: float = Query(
        default=None,
        ge=0.0, le=1.0,
        description="Max proportional detour, e.g. 0.15 = 15% (default: CORRIDOR_DETOUR_MAX_PCT from config)",
    ),
    time_window_minutes: int = Query(
        default=None,
        ge=0, le=240,
        description="±minutes time window for matching (default: CORRIDOR_TIME_WINDOW_MINUTES from config)",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    **Passenger search flow**: Given a RideRequest (pickup C, drop D), return all
    active rider-offered trips (A→B) where both C and D fall within the corridor
    buffer of the route, in the correct travel order, within detour and time thresholds.

    Results include the route polyline for map visualisation, corridor metrics,
    and a proportional fare estimate.
    """
    eff_buffer = buffer_m if buffer_m is not None else settings.CORRIDOR_BUFFER_M
    eff_detour_km = detour_max_km if detour_max_km is not None else settings.CORRIDOR_DETOUR_MAX_KM
    eff_detour_pct = detour_max_pct if detour_max_pct is not None else settings.CORRIDOR_DETOUR_MAX_PCT
    eff_window = time_window_minutes if time_window_minutes is not None else settings.CORRIDOR_TIME_WINDOW_MINUTES

    results = CorridorMatchingService.find_corridor_matches_for_request(
        db=db,
        current_user=current_user,
        ride_request_id=request_id,
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
