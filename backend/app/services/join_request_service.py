import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.fuel_share import FuelShare
from app.models.join_request import JoinRequest
from app.models.user import User
from app.schemas.fuel_share import FuelShareStatus
from app.schemas.join_request import JoinRequestStatus


class JoinRequestService:
    @staticmethod
    def create_join_request(
        db: Session, current_user: User, fuel_share_id: int
    ) -> JoinRequest:
        """Submit a request to join a Fuel Share."""
        trip = db.query(FuelShare).filter(FuelShare.id == fuel_share_id).first()
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fuel Share trip not found",
            )

        # Rule 1: Cannot join your own Fuel Share
        if trip.creator_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot request to join your own Fuel Share",
            )

        # Rule 2: Cannot join inactive trips (CANCELLED, COMPLETED, FULL)
        if trip.status != FuelShareStatus.ACTIVE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot join a Fuel Share with status '{trip.status}'",
            )

        # Rule 4: Must have available seats
        if trip.available_seats <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No available seats remaining on this Fuel Share",
            )

        # Rule 3: Cannot submit duplicate active requests
        existing_request = (
            db.query(JoinRequest)
            .filter(
                JoinRequest.fuel_share_id == fuel_share_id,
                JoinRequest.user_id == current_user.id,
            )
            .first()
        )

        if existing_request:
            if existing_request.status in [
                JoinRequestStatus.PENDING.value,
                JoinRequestStatus.ACCEPTED.value,
            ]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You already have an active or pending join request for this Fuel Share",
                )
            # If previous request was REJECTED or CANCELLED, reset to PENDING
            existing_request.status = JoinRequestStatus.PENDING.value
            existing_request.requested_at = datetime.datetime.now(datetime.timezone.utc)
            existing_request.accepted_at = None
            db.commit()
            db.refresh(existing_request)
            return existing_request

        join_req = JoinRequest(
            fuel_share_id=fuel_share_id,
            user_id=current_user.id,
            status=JoinRequestStatus.PENDING.value,
        )
        db.add(join_req)
        db.commit()
        db.refresh(join_req)
        return join_req

    @staticmethod
    def get_incoming_requests(
        db: Session, current_user: User, fuel_share_id: int
    ) -> list[JoinRequest]:
        """View incoming join requests for a Fuel Share (creator only)."""
        trip = db.query(FuelShare).filter(FuelShare.id == fuel_share_id).first()
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fuel Share trip not found",
            )

        if trip.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view incoming join requests for this Fuel Share",
            )

        return (
            db.query(JoinRequest)
            .filter(JoinRequest.fuel_share_id == fuel_share_id)
            .order_by(JoinRequest.requested_at.desc())
            .all()
        )

    @staticmethod
    def get_user_submitted_requests(
        db: Session, current_user: User
    ) -> list[JoinRequest]:
        """View all join requests submitted by the current user."""
        requests = (
            db.query(JoinRequest)
            .filter(JoinRequest.user_id == current_user.id)
            .order_by(JoinRequest.requested_at.desc())
            .all()
        )

        from app.models.corridor_match import CorridorMatch
        from app.models.ride_request import RideRequest
        from app.models.payment import Payment
        from app.schemas.payment import PaymentStatus

        for req in requests:
            match = (
                db.query(CorridorMatch)
                .join(RideRequest, RideRequest.id == CorridorMatch.ride_request_id)
                .filter(
                    CorridorMatch.fuel_share_id == req.fuel_share_id,
                    RideRequest.passenger_id == current_user.id,
                )
                .order_by(CorridorMatch.id.desc())
                .first()
            )
            if match:
                setattr(req, "fare_amount", round(match.fare_estimate, 2))
                if match.ride_request:
                    setattr(req, "pickup_name", match.ride_request.pickup_name)
                    setattr(req, "drop_name", match.ride_request.drop_name)

            payment = (
                db.query(Payment)
                .filter(
                    Payment.fuel_share_id == req.fuel_share_id,
                    Payment.user_id == current_user.id,
                )
                .order_by(Payment.id.desc())
                .first()
            )
            if payment and payment.status == PaymentStatus.SUCCESS.value:
                setattr(req, "payment_status", "SUCCESS")
                setattr(req, "is_paid", True)
            elif payment:
                setattr(req, "payment_status", payment.status)
                setattr(req, "is_paid", False)
            else:
                setattr(req, "payment_status", None)
                setattr(req, "is_paid", False)

        return requests

    @staticmethod
    def accept_join_request(
        db: Session, current_user: User, request_id: int
    ) -> JoinRequest:
        """Accept a pending join request (creator only) & reserve a seat atomically."""
        join_req = db.query(JoinRequest).filter(JoinRequest.id == request_id).first()
        if not join_req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Join request not found",
            )

        # Acquire row lock on FuelShare to prevent race conditions during seat deduction
        trip = (
            db.query(FuelShare)
            .filter(FuelShare.id == join_req.fuel_share_id)
            .with_for_update()
            .first()
        )

        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fuel Share trip not found",
            )

        if trip.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to accept join requests for this Fuel Share",
            )

        if join_req.status != JoinRequestStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot accept a request with status '{join_req.status}'",
            )

        if trip.available_seats <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No available seats remaining to accept this request",
            )

        # Transactional update
        join_req.status = JoinRequestStatus.ACCEPTED.value
        join_req.accepted_at = datetime.datetime.now(datetime.timezone.utc)
        trip.available_seats -= 1

        if trip.available_seats == 0:
            trip.status = FuelShareStatus.FULL.value

        db.commit()
        db.refresh(join_req)
        return join_req

    @staticmethod
    def reject_join_request(
        db: Session, current_user: User, request_id: int
    ) -> JoinRequest:
        """Reject a pending join request (creator only)."""
        join_req = db.query(JoinRequest).filter(JoinRequest.id == request_id).first()
        if not join_req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Join request not found",
            )

        trip = db.query(FuelShare).filter(FuelShare.id == join_req.fuel_share_id).first()
        if not trip or trip.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to reject join requests for this Fuel Share",
            )

        if join_req.status != JoinRequestStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot reject a request with status '{join_req.status}'",
            )

        join_req.status = JoinRequestStatus.REJECTED.value
        db.commit()
        db.refresh(join_req)
        return join_req

    @staticmethod
    def cancel_join_request(
        db: Session, current_user: User, request_id: int
    ) -> JoinRequest:
        """Cancel a pending join request (requesting user only)."""
        join_req = db.query(JoinRequest).filter(JoinRequest.id == request_id).first()
        if not join_req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Join request not found",
            )

        if join_req.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel another user's join request",
            )

        if join_req.status != JoinRequestStatus.PENDING.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel a request with status '{join_req.status}'",
            )

        join_req.status = JoinRequestStatus.CANCELLED.value
        db.commit()
        db.refresh(join_req)
        return join_req
