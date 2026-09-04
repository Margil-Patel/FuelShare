from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleUpdate


class VehicleService:
    @staticmethod
    def create_vehicle(db: Session, current_user: User, vehicle_in: VehicleCreate) -> Vehicle:
        """Creates a new vehicle owned by the authenticated user."""
        vehicle = Vehicle(
            user_id=current_user.id,
            vehicle_type=vehicle_in.vehicle_type,
            fuel_type=vehicle_in.fuel_type,
            mileage=vehicle_in.mileage,
            seating_capacity=vehicle_in.seating_capacity,
        )
        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        return vehicle

    @staticmethod
    def get_user_vehicles(db: Session, current_user: User) -> list[Vehicle]:
        """Retrieves all vehicles owned by the authenticated user."""
        return (
            db.query(Vehicle)
            .filter(Vehicle.user_id == current_user.id)
            .order_by(Vehicle.id.desc())
            .all()
        )

    @staticmethod
    def get_user_vehicle_by_id(db: Session, current_user: User, vehicle_id: int) -> Vehicle:
        """Retrieves a specific vehicle owned by the authenticated user, or raises 404."""
        vehicle = (
            db.query(Vehicle)
            .filter(Vehicle.id == vehicle_id, Vehicle.user_id == current_user.id)
            .first()
        )
        if not vehicle:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vehicle not found or access denied",
            )
        return vehicle

    @staticmethod
    def update_vehicle(
        db: Session, current_user: User, vehicle_id: int, vehicle_in: VehicleUpdate
    ) -> Vehicle:
        """Updates attributes of a vehicle owned by the authenticated user."""
        vehicle = VehicleService.get_user_vehicle_by_id(db, current_user, vehicle_id)

        if vehicle_in.vehicle_type is not None:
            vehicle.vehicle_type = vehicle_in.vehicle_type
        if vehicle_in.fuel_type is not None:
            vehicle.fuel_type = vehicle_in.fuel_type
        if vehicle_in.mileage is not None:
            vehicle.mileage = vehicle_in.mileage
        if vehicle_in.seating_capacity is not None:
            vehicle.seating_capacity = vehicle_in.seating_capacity

        db.add(vehicle)
        db.commit()
        db.refresh(vehicle)
        return vehicle

    @staticmethod
    def delete_vehicle(db: Session, current_user: User, vehicle_id: int) -> None:
        """Deletes a vehicle owned by the authenticated user."""
        vehicle = VehicleService.get_user_vehicle_by_id(db, current_user, vehicle_id)
        db.delete(vehicle)
        db.commit()
