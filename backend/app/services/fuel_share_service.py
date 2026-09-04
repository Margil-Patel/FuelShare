import datetime
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fuel_share import FuelShare
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.fuel_share import FuelShareCreate, FuelShareUpdate, FuelShareStatus
from app.services.location_service import LocationService


class FuelShareService:
    @staticmethod
    def create_fuel_share(
        db: Session, current_user: User, fuel_share_in: FuelShareCreate
    ) -> FuelShare:
        """Creates a new ACTIVE Fuel Share associated with the authenticated user.

        If estimated_distance is not provided, it is automatically computed using
        the Haversine formula based on source and destination coordinates.
        If estimated_fuel_cost is not provided, it is automatically computed based on distance and vehicle mileage.
        """
        estimated_distance = fuel_share_in.estimated_distance
        route_polyline: str | None = None

        if estimated_distance is None or estimated_distance <= 0:
            route_data = LocationService.get_route_with_polyline(
                fuel_share_in.source_latitude,
                fuel_share_in.source_longitude,
                fuel_share_in.destination_latitude,
                fuel_share_in.destination_longitude,
            )
            estimated_distance = route_data["distance_km"]
            route_polyline = route_data["polyline"] or None
        else:
            # Coordinates provided but distance was supplied manually — still fetch polyline
            try:
                route_data = LocationService.get_route_with_polyline(
                    fuel_share_in.source_latitude,
                    fuel_share_in.source_longitude,
                    fuel_share_in.destination_latitude,
                    fuel_share_in.destination_longitude,
                )
                route_polyline = route_data["polyline"] or None
            except Exception:
                route_polyline = None

        estimated_fuel_cost = fuel_share_in.estimated_fuel_cost
        if estimated_fuel_cost is None or estimated_fuel_cost <= 0:
            vehicle = (
                db.query(Vehicle)
                .filter(Vehicle.user_id == current_user.id)
                .order_by(Vehicle.created_at.desc())
                .first()
            )
            mileage = vehicle.mileage if (vehicle and vehicle.mileage > 0) else 15.0
            fuel_required = estimated_distance / mileage
            estimated_fuel_cost = round(fuel_required * settings.DEFAULT_FUEL_PRICE, 2)

        trip = FuelShare(
            creator_id=current_user.id,
            source_name=fuel_share_in.source_name,
            source_latitude=fuel_share_in.source_latitude,
            source_longitude=fuel_share_in.source_longitude,
            destination_name=fuel_share_in.destination_name,
            destination_latitude=fuel_share_in.destination_latitude,
            destination_longitude=fuel_share_in.destination_longitude,
            departure_date=fuel_share_in.departure_date,
            departure_time=fuel_share_in.departure_time,
            available_seats=fuel_share_in.available_seats,
            estimated_distance=estimated_distance,
            estimated_fuel_cost=estimated_fuel_cost,
            route_polyline=route_polyline,
            status=FuelShareStatus.ACTIVE.value,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        return trip

    @staticmethod
    def get_available_fuel_shares(
        db: Session,
        source: str | None = None,
        destination: str | None = None,
        departure_date: datetime.date | None = None,
    ) -> list[FuelShare]:
        """Lists available ACTIVE Fuel Shares with optional basic search filters, excluding past trips."""
        today = datetime.date.today()
        now_time = datetime.datetime.now().time()

        query = db.query(FuelShare).filter(FuelShare.status == FuelShareStatus.ACTIVE.value)

        if source:
            query = query.filter(FuelShare.source_name.ilike(f"%{source.strip()}%"))
        if destination:
            query = query.filter(FuelShare.destination_name.ilike(f"%{destination.strip()}%"))
        if departure_date:
            query = query.filter(FuelShare.departure_date == departure_date)
        else:
            query = query.filter(
                (FuelShare.departure_date > today)
                | ((FuelShare.departure_date == today) & (FuelShare.departure_time >= now_time))
            )

        return query.order_by(FuelShare.departure_date.asc(), FuelShare.departure_time.asc()).all()

    @staticmethod
    def get_fuel_share_by_id(db: Session, fuel_share_id: int) -> FuelShare:
        """Retrieves a specific Fuel Share by ID or raises 404."""
        trip = db.query(FuelShare).filter(FuelShare.id == fuel_share_id).first()
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fuel Share trip not found",
            )
        return trip

    @staticmethod
    def get_user_fuel_shares(db: Session, current_user: User) -> list[FuelShare]:
        """Retrieves all Fuel Shares created by the authenticated user."""
        return (
            db.query(FuelShare)
            .filter(FuelShare.creator_id == current_user.id)
            .order_by(FuelShare.created_at.desc())
            .all()
        )

    @staticmethod
    def update_fuel_share(
        db: Session, current_user: User, fuel_share_id: int, fuel_share_in: FuelShareUpdate
    ) -> FuelShare:
        """Updates attributes of a Fuel Share (creator only).

        Recalculates distance if coordinates change and estimated_distance is not provided.
        """
        trip = FuelShareService.get_fuel_share_by_id(db, fuel_share_id)

        if trip.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to modify this Fuel Share",
            )

        update_data = fuel_share_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if value is not None:
                if isinstance(value, FuelShareStatus):
                    setattr(trip, field, value.value)
                else:
                    setattr(trip, field, value)

        # If coordinates updated and distance wasn't explicitly updated, recalculate
        if (
            "source_latitude" in update_data
            or "source_longitude" in update_data
            or "destination_latitude" in update_data
            or "destination_longitude" in update_data
        ) and "estimated_distance" not in update_data:
            trip.estimated_distance = LocationService.get_driving_distance(
                trip.source_latitude,
                trip.source_longitude,
                trip.destination_latitude,
                trip.destination_longitude,
            )

        db.add(trip)
        db.commit()
        db.refresh(trip)
        return trip

    @staticmethod
    def delete_fuel_share(db: Session, current_user: User, fuel_share_id: int) -> None:
        """Deletes/cancels a Fuel Share (creator only)."""
        trip = FuelShareService.get_fuel_share_by_id(db, fuel_share_id)

        if trip.creator_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel or delete this Fuel Share",
            )

        db.delete(trip)
        db.commit()
