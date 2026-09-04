"""
RideRequest CRUD service.

Handles creation, retrieval, and status management for passenger ride requests
used in the corridor-based matching flow.
"""
import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.ride_request import RideRequest
from app.models.user import User


class RideRequestStatus:
    OPEN = "OPEN"
    MATCHED = "MATCHED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class RideRequestService:
    @staticmethod
    def create_ride_request(
        db: Session,
        current_user: User,
        pickup_name: str,
        pickup_latitude: float,
        pickup_longitude: float,
        drop_name: str,
        drop_latitude: float,
        drop_longitude: float,
        desired_departure: datetime.datetime,
        seats_needed: int = 1,
    ) -> RideRequest:
        """Create a new OPEN RideRequest for the authenticated passenger."""
        if pickup_latitude == drop_latitude and pickup_longitude == drop_longitude:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Pickup and drop locations cannot be the same point.",
            )
        if seats_needed < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="seats_needed must be at least 1.",
            )

        ride_request = RideRequest(
            passenger_id=current_user.id,
            pickup_name=pickup_name,
            pickup_latitude=pickup_latitude,
            pickup_longitude=pickup_longitude,
            drop_name=drop_name,
            drop_latitude=drop_latitude,
            drop_longitude=drop_longitude,
            desired_departure=desired_departure,
            seats_needed=seats_needed,
            status=RideRequestStatus.OPEN,
        )
        db.add(ride_request)
        db.commit()
        db.refresh(ride_request)
        return ride_request

    @staticmethod
    def get_ride_request_by_id(db: Session, request_id: int) -> RideRequest:
        """Retrieve a RideRequest by ID or raise 404."""
        req = db.query(RideRequest).filter(RideRequest.id == request_id).first()
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Ride request not found.",
            )
        return req

    @staticmethod
    def get_my_ride_requests(db: Session, current_user: User) -> list[RideRequest]:
        """Return all RideRequests submitted by the current user, newest first."""
        return (
            db.query(RideRequest)
            .filter(RideRequest.passenger_id == current_user.id)
            .order_by(RideRequest.created_at.desc())
            .all()
        )

    @staticmethod
    def cancel_ride_request(
        db: Session, current_user: User, request_id: int
    ) -> RideRequest:
        """Cancel an OPEN RideRequest (passenger only)."""
        req = RideRequestService.get_ride_request_by_id(db, request_id)
        if req.passenger_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this ride request.",
            )
        if req.status != RideRequestStatus.OPEN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel a ride request with status '{req.status}'.",
            )
        req.status = RideRequestStatus.CANCELLED
        db.commit()
        db.refresh(req)
        return req
