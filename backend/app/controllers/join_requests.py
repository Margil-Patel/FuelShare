from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.join_request import JoinRequestResponse
from app.services.join_request_service import JoinRequestService

router = APIRouter(tags=["Join Requests"])


@router.post(
    "/fuel-shares/{fuel_share_id}/join",
    response_model=JoinRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a Join Request for a Fuel Share",
)
def create_join_request(
    fuel_share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submits a request to join an active Fuel Share with available seats."""
    return JoinRequestService.create_join_request(db, current_user, fuel_share_id)


@router.get(
    "/fuel-shares/{fuel_share_id}/requests",
    response_model=list[JoinRequestResponse],
    summary="View Incoming Join Requests for a Fuel Share",
)
def get_incoming_requests(
    fuel_share_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves all incoming join requests for a Fuel Share (creator only)."""
    return JoinRequestService.get_incoming_requests(db, current_user, fuel_share_id)


@router.get(
    "/users/me/join-requests",
    response_model=list[JoinRequestResponse],
    summary="Get Current User's Submitted Join Requests",
)
def get_my_join_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves all join requests submitted by the current user."""
    return JoinRequestService.get_user_submitted_requests(db, current_user)


@router.put(
    "/join-requests/{request_id}/accept",
    response_model=JoinRequestResponse,
    summary="Accept a Join Request",
)
def accept_join_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accepts a pending join request and reserves a seat (creator only)."""
    return JoinRequestService.accept_join_request(db, current_user, request_id)


@router.put(
    "/join-requests/{request_id}/reject",
    response_model=JoinRequestResponse,
    summary="Reject a Join Request",
)
def reject_join_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rejects a pending join request (creator only)."""
    return JoinRequestService.reject_join_request(db, current_user, request_id)


@router.delete(
    "/join-requests/{request_id}",
    response_model=JoinRequestResponse,
    summary="Cancel a Join Request",
)
def cancel_join_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancels a pending join request (requesting user only)."""
    return JoinRequestService.cancel_join_request(db, current_user, request_id)
