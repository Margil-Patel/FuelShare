import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fuel_share import FuelShare
from app.models.user import User
from app.schemas.fuel_share import FuelShareStatus
from app.schemas.matching import MatchItemResponse, MatchListResponse
from app.services.fuel_share_service import FuelShareService
from app.services.location_service import LocationService


class MatchingService:
    @staticmethod
    def calculate_match(
        requested_trip: FuelShare, candidate_trip: FuelShare
    ) -> tuple[int, list[str], float, float, int]:
        """Calculates rule-based match score (0-100), reasons, and metric deltas

        between a requested trip and a candidate trip.
        """
        # 1. Pickup Proximity (20 points max)
        d_src = LocationService.haversine_distance(
            requested_trip.source_latitude,
            requested_trip.source_longitude,
            candidate_trip.source_latitude,
            candidate_trip.source_longitude,
        )
        if d_src <= 1.0:
            pickup_pts = 20
        elif d_src <= 3.0:
            pickup_pts = 16
        elif d_src <= 5.0:
            pickup_pts = 12
        elif d_src <= 10.0:
            pickup_pts = 8
        elif d_src <= 15.0:
            pickup_pts = 4
        else:
            pickup_pts = 0

        # 2. Destination Proximity (10 points max)
        d_dst = LocationService.haversine_distance(
            requested_trip.destination_latitude,
            requested_trip.destination_longitude,
            candidate_trip.destination_latitude,
            candidate_trip.destination_longitude,
        )
        if d_dst <= 1.0:
            dest_pts = 10
        elif d_dst <= 3.0:
            dest_pts = 8
        elif d_dst <= 5.0:
            dest_pts = 6
        elif d_dst <= 10.0:
            dest_pts = 4
        elif d_dst <= 15.0:
            dest_pts = 2
        else:
            dest_pts = 0

        # 3. Route Similarity (40 points max based on total endpoint displacement)
        d_route = d_src + d_dst
        if d_route <= 2.0:
            route_pts = 40
        elif d_route <= 5.0:
            route_pts = 32
        elif d_route <= 10.0:
            route_pts = 24
        elif d_route <= 20.0:
            route_pts = 16
        elif d_route <= 30.0:
            route_pts = 8
        else:
            route_pts = 0

        # 4. Departure Time Proximity (25 points max)
        dt_req = datetime.datetime.combine(
            requested_trip.departure_date, requested_trip.departure_time
        )
        dt_cand = datetime.datetime.combine(
            candidate_trip.departure_date, candidate_trip.departure_time
        )
        delta_minutes = int(abs((dt_req - dt_cand).total_seconds()) // 60)

        if delta_minutes <= 15:
            time_pts = 25
        elif delta_minutes <= 30:
            time_pts = 20
        elif delta_minutes <= 60:
            time_pts = 15
        elif delta_minutes <= 120:
            time_pts = 10
        elif delta_minutes <= 240:
            time_pts = 5
        else:
            time_pts = 0

        # 5. Seat Availability (5 points max)
        seat_pts = 5 if candidate_trip.available_seats > 0 else 0

        total_score = min(100, route_pts + time_pts + pickup_pts + dest_pts + seat_pts)

        # Build Human-Readable Reasons
        reasons: list[str] = []
        if d_dst <= 1.0:
            reasons.append("Same destination area")
        elif d_dst <= 5.0:
            reasons.append(f"Destinations are only {d_dst:.1f} km apart")

        if d_src <= 1.0:
            reasons.append(f"Pickup locations are only {d_src:.1f} km apart")
        elif d_src <= 5.0:
            reasons.append(f"Pickup locations are within {d_src:.1f} km")

        if delta_minutes <= 15:
            reasons.append("Departure time is within 15 minutes")
        elif delta_minutes <= 60:
            reasons.append(f"Departure time is within {delta_minutes} minutes")

        if route_pts >= 24:
            reasons.append("Very similar journey route")

        if candidate_trip.available_seats > 0:
            reasons.append(f"{candidate_trip.available_seats} seats available")

        return total_score, reasons, d_src, d_dst, delta_minutes

    @staticmethod
    def find_matches_for_trip(
        db: Session, current_user: User, fuel_share_id: int
    ) -> MatchListResponse:
        """Finds and ranks compatible active Fuel Shares for a user's trip."""
        # 1. Fetch requested trip
        requested_trip = FuelShareService.get_fuel_share_by_id(db, fuel_share_id)

        # 2. Authorization check: Only creator can request matches for their trip
        if requested_trip.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to request matches for this Fuel Share",
            )

        # 3. Query candidate trips from PostgreSQL
        # Exclude: self, creator's own trips, non-ACTIVE trips, trips without seats
        today_date = datetime.date.today()
        now_time = datetime.datetime.now().time()

        candidates = (
            db.query(FuelShare)
            .filter(
                FuelShare.id != requested_trip.id,
                FuelShare.creator_id != current_user.id,
                FuelShare.status == FuelShareStatus.ACTIVE.value,
                FuelShare.available_seats > 0,
                FuelShare.departure_date >= today_date,
            )
            .all()
        )

        matches: list[MatchItemResponse] = []

        for candidate in candidates:
            # Exclude past departure times for today's trips
            if (
                candidate.departure_date == today_date
                and candidate.departure_time < now_time
            ):
                continue

            score, reasons, d_src, d_dst, delta_mins = MatchingService.calculate_match(
                requested_trip, candidate
            )

            # Threshold filtering
            if score >= settings.MATCH_THRESHOLD:
                match_item = MatchItemResponse(
                    fuel_share_id=candidate.id,
                    creator_id=candidate.creator_id,
                    match_score=score,
                    reasons=reasons,
                    pickup_distance_km=d_src,
                    destination_distance_km=d_dst,
                    time_difference_minutes=delta_mins,
                    source_name=candidate.source_name,
                    destination_name=candidate.destination_name,
                    departure_date=candidate.departure_date,
                    departure_time=candidate.departure_time,
                    available_seats=candidate.available_seats,
                    estimated_fuel_cost=candidate.estimated_fuel_cost,
                )
                matches.append(match_item)

        # Sort matches descending by score
        matches.sort(key=lambda m: m.match_score, reverse=True)

        return MatchListResponse(
            requested_fuel_share_id=requested_trip.id,
            total_matches=len(matches),
            match_threshold=settings.MATCH_THRESHOLD,
            matches=matches,
        )
