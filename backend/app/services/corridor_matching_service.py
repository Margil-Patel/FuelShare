"""
Corridor-Based Route Matching Engine
=====================================

Implements two symmetric search flows:

Passenger view (find_corridor_matches_for_request):
    Given a RideRequest (C→D), find all ACTIVE FuelShare rides (A→B) where both
    C and D fall within ``buffer_m`` metres of the route polyline, C comes before
    D along the route, and the detour/time constraints are satisfied.

Rider view (find_corridor_matches_for_ride):
    Given a FuelShare (A→B), find all OPEN RideRequests (C→D) that fall inside
    the route corridor.

Core algorithm (equivalent to PostGIS ST_DWithin + ST_LineLocatePoint):
  1.  Decode route_polyline → list of (lat, lon) waypoints.
  2.  min_dist(C, polyline) ≤ buffer_m  AND  min_dist(D, polyline) ≤ buffer_m
  3.  locate(C, polyline) < locate(D, polyline)   (correct travel direction)
  4.  detour = haversine(A→C) + haversine(C→D) + haversine(D→B) − dist(A→B)
              ≤ min(CORRIDOR_DETOUR_MAX_KM, CORRIDOR_DETOUR_MAX_PCT * dist_AB)
  5.  |desired_departure − departure| ≤ CORRIDOR_TIME_WINDOW_MINUTES
  6.  available_seats ≥ seats_needed
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass, field

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.corridor_match import CorridorMatch
from app.models.fuel_share import FuelShare
from app.models.ride_request import RideRequest
from app.models.user import User
from app.schemas.fuel_share import FuelShareStatus
from app.services.fare_calculator import get_fare_strategy
from app.services.location_service import LocationService
from app.services.polyline_utils import (
    decode_polyline,
    locate_point_on_polyline,
    min_distance_to_polyline_m,
)
from app.services.ride_request_service import RideRequestService, RideRequestStatus


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class CorridorMatchResult:
    """DTO for one matching result returned by the engine."""
    fuel_share_id: int
    ride_request_id: int
    driver_id: int

    # Corridor metrics
    pickup_buffer_m: float
    drop_buffer_m: float
    pickup_fraction: float
    drop_fraction: float
    detour_distance_m: float

    # Ride metadata
    source_name: str
    destination_name: str
    departure_datetime: datetime.datetime
    available_seats: int
    total_route_km: float
    route_polyline: str | None

    # Fare
    fare_estimate: float
    fare_strategy: str

    # Passenger metadata (set in rider view)
    passenger_id: int | None = None
    pickup_name: str = ""
    drop_name: str = ""
    seats_needed: int = 1
    pickup_latitude: float = 0.0
    pickup_longitude: float = 0.0
    drop_latitude: float = 0.0
    drop_longitude: float = 0.0
    desired_departure: datetime.datetime | None = None

    # Existing CorridorMatch DB record (if persisted)
    match_id: int | None = None
    match_status: str = "PROPOSED"


# ---------------------------------------------------------------------------
# Helper: build departure datetime from FuelShare
# ---------------------------------------------------------------------------

def _fuel_share_departure_dt(trip: FuelShare) -> datetime.datetime:
    return datetime.datetime.combine(trip.departure_date, trip.departure_time)


# ---------------------------------------------------------------------------
# Core matching engine
# ---------------------------------------------------------------------------

class CorridorMatchingService:
    """Stateless service encapsulating the corridor matching algorithm."""

    # ------------------------------------------------------------------
    # Internal algorithm
    # ------------------------------------------------------------------

    @staticmethod
    def _run_corridor_check(
        trip: FuelShare,
        request: RideRequest,
        buffer_m: int,
        detour_max_km: float,
        detour_max_pct: float,
    ) -> CorridorMatchResult | None:
        """
        Evaluate whether *request* (C→D) matches *trip* (A→B) via corridor logic.

        Returns a ``CorridorMatchResult`` on success, or ``None`` if any check fails.
        """
        # --- 1. Decode polyline -------------------------------------------
        polyline_str = trip.route_polyline or ""
        if not polyline_str:
            # No geometry stored — build a straight-line approximation
            polyline_str = ""
            from app.services.polyline_utils import encode_polyline
            coords = [(trip.source_latitude, trip.source_longitude),
                      (trip.destination_latitude, trip.destination_longitude)]
        else:
            coords = decode_polyline(polyline_str)

        if len(coords) < 2:
            return None  # degenerate route

        C = (request.pickup_latitude, request.pickup_longitude)
        D = (request.drop_latitude, request.drop_longitude)

        # --- 2. Buffer check (equivalent to ST_DWithin) -------------------
        dist_c = min_distance_to_polyline_m(C, coords)
        dist_d = min_distance_to_polyline_m(D, coords)

        if dist_c > buffer_m or dist_d > buffer_m:
            return None

        # --- 3. Direction check (equivalent to ST_LineLocatePoint) --------
        frac_c = locate_point_on_polyline(C, coords)
        frac_d = locate_point_on_polyline(D, coords)

        if frac_c >= frac_d:
            return None  # C is after D — wrong direction

        # --- 4. Detour check ----------------------------------------------
        dist_ab = trip.estimated_distance  # km A→B
        dist_ac = LocationService.haversine_distance(
            trip.source_latitude, trip.source_longitude,
            request.pickup_latitude, request.pickup_longitude,
        )
        dist_cd = LocationService.haversine_distance(
            request.pickup_latitude, request.pickup_longitude,
            request.drop_latitude, request.drop_longitude,
        )
        dist_db = LocationService.haversine_distance(
            request.drop_latitude, request.drop_longitude,
            trip.destination_latitude, trip.destination_longitude,
        )
        detour_km = max(0.0, dist_ac + dist_cd + dist_db - dist_ab)
        threshold_km = min(detour_max_km, detour_max_pct * dist_ab)
        if detour_km > threshold_km:
            return None

        # --- 5. Fare estimation -------------------------------------------
        strategy = get_fare_strategy(settings.FARE_SPLIT_STRATEGY)
        fare = strategy.calculate(
            passenger_distance_km=dist_cd,
            total_distance_km=dist_ab,
            total_fuel_cost=trip.estimated_fuel_cost,
            n_passengers=max(1, request.seats_needed),
        )

        departure_dt = _fuel_share_departure_dt(trip)

        return CorridorMatchResult(
            fuel_share_id=trip.id,
            ride_request_id=request.id,
            driver_id=trip.creator_id,
            pickup_buffer_m=round(dist_c, 2),
            drop_buffer_m=round(dist_d, 2),
            pickup_fraction=round(frac_c, 4),
            drop_fraction=round(frac_d, 4),
            detour_distance_m=round(detour_km * 1000, 2),
            source_name=trip.source_name,
            destination_name=trip.destination_name,
            departure_datetime=departure_dt,
            available_seats=trip.available_seats,
            total_route_km=dist_ab,
            route_polyline=trip.route_polyline,
            fare_estimate=fare,
            fare_strategy=strategy.name,
            passenger_id=request.passenger_id,
            pickup_name=request.pickup_name,
            drop_name=request.drop_name,
            seats_needed=request.seats_needed,
            pickup_latitude=request.pickup_latitude,
            pickup_longitude=request.pickup_longitude,
            drop_latitude=request.drop_latitude,
            drop_longitude=request.drop_longitude,
            desired_departure=request.desired_departure,
        )

    # ------------------------------------------------------------------
    # Public API: Passenger search
    # ------------------------------------------------------------------

    @staticmethod
    def find_corridor_matches_for_request(
        db: Session,
        current_user: User,
        ride_request_id: int,
        buffer_m: int | None = None,
        detour_max_km: float | None = None,
        detour_max_pct: float | None = None,
        time_window_minutes: int | None = None,
    ) -> list[CorridorMatchResult]:
        """
        Passenger search: return all active FuelShare rides (A→B) that match
        the passenger's RideRequest (C→D) via corridor logic.
        """
        buffer_m = buffer_m if buffer_m is not None else settings.CORRIDOR_BUFFER_M
        detour_max_km = detour_max_km if detour_max_km is not None else settings.CORRIDOR_DETOUR_MAX_KM
        detour_max_pct = detour_max_pct if detour_max_pct is not None else settings.CORRIDOR_DETOUR_MAX_PCT
        time_window_minutes = (
            time_window_minutes if time_window_minutes is not None
            else settings.CORRIDOR_TIME_WINDOW_MINUTES
        )

        request = RideRequestService.get_ride_request_by_id(db, ride_request_id)

        if request.passenger_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view matches for this ride request.",
            )

        desired_dt = request.desired_departure
        window = datetime.timedelta(minutes=time_window_minutes)
        earliest = desired_dt - window
        latest = desired_dt + window

        # Candidate rides: ACTIVE, has seats, departure in time window
        candidates = (
            db.query(FuelShare)
            .filter(
                FuelShare.status == FuelShareStatus.ACTIVE.value,
                FuelShare.available_seats >= request.seats_needed,
                FuelShare.creator_id != current_user.id,
            )
            .all()
        )

        results: list[CorridorMatchResult] = []
        for trip in candidates:
            dep_dt = _fuel_share_departure_dt(trip)
            if not (earliest <= dep_dt <= latest):
                continue

            match_result = CorridorMatchingService._run_corridor_check(
                trip, request, buffer_m, detour_max_km, detour_max_pct
            )
            if match_result:
                results.append(match_result)

        # Sort by detour ascending (lowest detour = most convenient for driver)
        results.sort(key=lambda r: r.detour_distance_m)
        return results

    # ------------------------------------------------------------------
    # Public API: Rider view
    # ------------------------------------------------------------------

    @staticmethod
    def find_corridor_matches_for_ride(
        db: Session,
        current_user: User,
        fuel_share_id: int,
        buffer_m: int | None = None,
        detour_max_km: float | None = None,
        detour_max_pct: float | None = None,
        time_window_minutes: int | None = None,
    ) -> list[CorridorMatchResult]:
        """
        Rider view: for a given FuelShare (A→B), return all OPEN RideRequests
        (C→D) whose pickup and drop fall in the corridor, in correct order.
        """
        buffer_m = buffer_m if buffer_m is not None else settings.CORRIDOR_BUFFER_M
        detour_max_km = detour_max_km if detour_max_km is not None else settings.CORRIDOR_DETOUR_MAX_KM
        detour_max_pct = detour_max_pct if detour_max_pct is not None else settings.CORRIDOR_DETOUR_MAX_PCT
        time_window_minutes = (
            time_window_minutes if time_window_minutes is not None
            else settings.CORRIDOR_TIME_WINDOW_MINUTES
        )

        trip = db.query(FuelShare).filter(FuelShare.id == fuel_share_id).first()
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fuel Share not found.",
            )
        if trip.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view corridor matches for this Fuel Share.",
            )

        dep_dt = _fuel_share_departure_dt(trip)
        window = datetime.timedelta(minutes=time_window_minutes)
        earliest = dep_dt - window
        latest = dep_dt + window

        # Candidate requests: OPEN, in time window
        candidates = (
            db.query(RideRequest)
            .filter(
                RideRequest.status == RideRequestStatus.OPEN,
                RideRequest.seats_needed <= trip.available_seats,
                RideRequest.desired_departure >= earliest,
                RideRequest.desired_departure <= latest,
                RideRequest.passenger_id != current_user.id,
            )
            .all()
        )

        results: list[CorridorMatchResult] = []
        for request in candidates:
            match_result = CorridorMatchingService._run_corridor_check(
                trip, request, buffer_m, detour_max_km, detour_max_pct
            )
            if match_result:
                results.append(match_result)

        results.sort(key=lambda r: r.detour_distance_m)
        return results

    # ------------------------------------------------------------------
    # Public API: Accept a match
    # ------------------------------------------------------------------

    @staticmethod
    def accept_corridor_match(
        db: Session,
        current_user: User,
        match_id: int,
    ) -> CorridorMatch:
        """
        Rider accepts a PROPOSED corridor match.

        - Validates that current_user is the ride creator.
        - Decrements available_seats with a row lock (prevents double-booking).
        - Sets match status → ACCEPTED.
        - Sets ride_request status → MATCHED.
        - Returns the CorridorMatch with fare_estimate ready for the Razorpay hook.
        """
        match = db.query(CorridorMatch).filter(CorridorMatch.id == match_id).first()
        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Corridor match not found.",
            )

        if match.status != "PROPOSED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot accept a match with status '{match.status}'.",
            )

        # Row-lock the FuelShare to prevent concurrent seat deductions
        trip = (
            db.query(FuelShare)
            .filter(FuelShare.id == match.fuel_share_id)
            .with_for_update()
            .first()
        )
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fuel Share not found.",
            )

        if trip.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the ride creator can accept corridor matches.",
            )

        ride_request = (
            db.query(RideRequest)
            .filter(RideRequest.id == match.ride_request_id)
            .first()
        )
        if not ride_request:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ride request not found.",
            )

        if trip.available_seats < ride_request.seats_needed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not enough available seats to accept this request.",
            )

        # Transactional updates
        match.status = "ACCEPTED"
        ride_request.status = RideRequestStatus.MATCHED
        trip.available_seats -= ride_request.seats_needed

        db.commit()
        db.refresh(match)
        return match

    # ------------------------------------------------------------------
    # Public API: Reject a match
    # ------------------------------------------------------------------

    @staticmethod
    def reject_corridor_match(
        db: Session,
        current_user: User,
        match_id: int,
    ) -> CorridorMatch:
        """Rider rejects a PROPOSED corridor match."""
        match = db.query(CorridorMatch).filter(CorridorMatch.id == match_id).first()
        if not match:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Corridor match not found.",
            )

        trip = db.query(FuelShare).filter(FuelShare.id == match.fuel_share_id).first()
        if not trip or trip.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the ride creator can reject corridor matches.",
            )

        if match.status != "PROPOSED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject a match with status '{match.status}'.",
            )

        match.status = "REJECTED"
        db.commit()
        db.refresh(match)
        return match

    # ------------------------------------------------------------------
    # Public API: Persist a proposed match
    # ------------------------------------------------------------------

    @staticmethod
    def propose_corridor_match(
        db: Session,
        ride_match: CorridorMatchResult,
    ) -> CorridorMatch:
        """
        Persist a PROPOSED CorridorMatch record linking a FuelShare to a RideRequest.
        Returns existing record if one already exists in PROPOSED status.
        """
        existing = (
            db.query(CorridorMatch)
            .filter(
                CorridorMatch.fuel_share_id == ride_match.fuel_share_id,
                CorridorMatch.ride_request_id == ride_match.ride_request_id,
                CorridorMatch.status == "PROPOSED",
            )
            .first()
        )
        if existing:
            return existing

        new_match = CorridorMatch(
            fuel_share_id=ride_match.fuel_share_id,
            ride_request_id=ride_match.ride_request_id,
            detour_distance_m=ride_match.detour_distance_m,
            pickup_buffer_m=ride_match.pickup_buffer_m,
            drop_buffer_m=ride_match.drop_buffer_m,
            pickup_fraction=ride_match.pickup_fraction,
            drop_fraction=ride_match.drop_fraction,
            fare_estimate=ride_match.fare_estimate,
            fare_strategy=ride_match.fare_strategy,
            status="PROPOSED",
        )
        db.add(new_match)
        db.commit()
        db.refresh(new_match)
        return new_match
