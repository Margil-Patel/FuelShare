from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fuel_share import FuelShare
from app.models.join_request import JoinRequest
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.fuel_cost import FuelCostResponse
from app.schemas.join_request import JoinRequestStatus
from app.services.location_service import LocationService


class FuelCalculatorService:
    @staticmethod
    def _to_decimal(val: float | int | str | Decimal) -> Decimal:
        return Decimal(str(val))

    @staticmethod
    def _round(val: Decimal, decimal_places: int = 2) -> Decimal:
        quantifier = Decimal("10") ** -decimal_places
        return val.quantize(quantifier, rounding=ROUND_HALF_UP)

    @staticmethod
    def calculate_fuel_required(
        distance_km: Decimal | float, mileage_kpl: Decimal | float
    ) -> Decimal:
        """Calculate required fuel in litres.

        Formula: distance_km / mileage_kpl
        """
        dist = FuelCalculatorService._to_decimal(distance_km)
        m = FuelCalculatorService._to_decimal(mileage_kpl)

        if m <= Decimal("0"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vehicle mileage must be greater than zero.",
            )

        fuel = dist / m
        return FuelCalculatorService._round(fuel, 2)

    @staticmethod
    def calculate_total_fuel_cost(
        fuel_required_litres: Decimal | float, fuel_price_per_litre: Decimal | float
    ) -> Decimal:
        """Calculate total fuel cost.

        Formula: fuel_required_litres * fuel_price_per_litre
        """
        fuel = FuelCalculatorService._to_decimal(fuel_required_litres)
        price = FuelCalculatorService._to_decimal(fuel_price_per_litre)
        cost = fuel * price
        return FuelCalculatorService._round(cost, 2)

    @staticmethod
    def calculate_cost_per_participant(
        total_fuel_cost: Decimal | float, participant_count: int
    ) -> Decimal:
        """Calculate cost per participant using equal sharing model.

        Formula: total_fuel_cost / participant_count
        """
        cost = FuelCalculatorService._to_decimal(total_fuel_cost)

        if participant_count <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Participant count must be greater than zero.",
            )

        per_person = cost / Decimal(participant_count)
        return FuelCalculatorService._round(per_person, 2)

    @staticmethod
    def calculate_estimated_savings_per_participant(
        total_fuel_cost: Decimal | float, cost_per_participant: Decimal | float
    ) -> Decimal:
        """Calculate estimated savings per participant compared to driving solo.

        Formula: total_fuel_cost - cost_per_participant
        """
        total = FuelCalculatorService._to_decimal(total_fuel_cost)
        per_person = FuelCalculatorService._to_decimal(cost_per_participant)
        savings = total - per_person
        return FuelCalculatorService._round(savings, 2)

    @staticmethod
    def calculate_estimated_fuel_saved(
        fuel_required_litres: Decimal | float, participant_count: int
    ) -> Decimal:
        """Calculate estimated fuel saved in litres.

        Assumption: If each participant drove solo, total fuel would be (participant_count * fuel_required).
        Shared fuel requirement is fuel_required.
        Fuel saved = (participant_count - 1) * fuel_required.
        """
        fuel = FuelCalculatorService._to_decimal(fuel_required_litres)
        if participant_count <= 1:
            return Decimal("0.00")

        saved = Decimal(participant_count - 1) * fuel
        return FuelCalculatorService._round(saved, 2)

    @staticmethod
    def get_fuel_cost_breakdown(
        db: Session,
        current_user: User,
        fuel_share_id: int,
        custom_fuel_price: float | None = None,
    ) -> FuelCostResponse:
        """Calculate and return fuel cost and savings breakdown for a Fuel Share."""
        trip = db.query(FuelShare).filter(FuelShare.id == fuel_share_id).first()
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Fuel Share trip not found",
            )

        # Access Control: Creator OR Accepted Participant
        is_creator = trip.creator_id == current_user.id
        is_accepted_participant = False
        if not is_creator:
            accepted_req = (
                db.query(JoinRequest)
                .filter(
                    JoinRequest.fuel_share_id == fuel_share_id,
                    JoinRequest.user_id == current_user.id,
                    JoinRequest.status == JoinRequestStatus.ACCEPTED.value,
                )
                .first()
            )
            if accepted_req:
                is_accepted_participant = True

        if not is_creator and not is_accepted_participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view fuel cost details for this Fuel Share",
            )

        # Check if current user is a corridor passenger (traveling C -> D)
        from app.models.corridor_match import CorridorMatch
        from app.models.ride_request import RideRequest

        corridor_match = (
            db.query(CorridorMatch)
            .join(RideRequest, RideRequest.id == CorridorMatch.ride_request_id)
            .filter(
                CorridorMatch.fuel_share_id == fuel_share_id,
                RideRequest.passenger_id == current_user.id,
            )
            .order_by(CorridorMatch.id.desc())
            .first()
        )

        # Retrieve vehicle information for creator
        vehicle = (
            db.query(Vehicle)
            .filter(Vehicle.user_id == trip.creator_id)
            .order_by(Vehicle.created_at.desc())
            .first()
        )
        if not vehicle and not corridor_match:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No vehicle registered for the creator of this Fuel Share. Vehicle mileage is required.",
            )

        if vehicle and vehicle.mileage <= 0 and not corridor_match:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vehicle mileage must be greater than zero.",
            )

        vehicle_mileage = vehicle.mileage if vehicle and vehicle.mileage > 0 else Decimal("15.0")

        # Retrieve distance
        distance_km = trip.estimated_distance
        if not distance_km or distance_km <= 0:
            distance_km = LocationService.get_driving_distance(
                trip.source_latitude,
                trip.source_longitude,
                trip.destination_latitude,
                trip.destination_longitude,
            )

        # Retrieve accepted participants count
        accepted_requests_count = (
            db.query(JoinRequest)
            .filter(
                JoinRequest.fuel_share_id == fuel_share_id,
                JoinRequest.status == JoinRequestStatus.ACCEPTED.value,
            )
            .count()
        )
        participant_count = 1 + accepted_requests_count

        # Fuel price setup
        fuel_price = (
            custom_fuel_price
            if custom_fuel_price is not None
            else settings.DEFAULT_FUEL_PRICE
        )

        # Perform calculations
        fuel_required = FuelCalculatorService.calculate_fuel_required(
            distance_km, vehicle_mileage
        )
        total_cost = FuelCalculatorService.calculate_total_fuel_cost(
            fuel_required, fuel_price
        )
        cost_per_person = FuelCalculatorService.calculate_cost_per_participant(
            total_cost, participant_count
        )
        savings_per_person = (
            FuelCalculatorService.calculate_estimated_savings_per_participant(
                total_cost, cost_per_person
            )
        )
        fuel_saved = FuelCalculatorService.calculate_estimated_fuel_saved(
            fuel_required, participant_count
        )

        # If current user is a corridor passenger (traveling C -> D), their share is the corridor fare estimate
        from app.models.corridor_match import CorridorMatch
        from app.models.ride_request import RideRequest

        corridor_match = (
            db.query(CorridorMatch)
            .join(RideRequest, RideRequest.id == CorridorMatch.ride_request_id)
            .filter(
                CorridorMatch.fuel_share_id == fuel_share_id,
                RideRequest.passenger_id == current_user.id,
            )
            .order_by(CorridorMatch.id.desc())
            .first()
        )
        if corridor_match and corridor_match.fare_estimate > 0:
            cost_per_person = FuelCalculatorService._round(FuelCalculatorService._to_decimal(corridor_match.fare_estimate))
            savings_per_person = (
                FuelCalculatorService.calculate_estimated_savings_per_participant(
                    total_cost, cost_per_person
                )
            )

        return FuelCostResponse(
            fuel_share_id=trip.id,
            distance_km=float(distance_km),
            fuel_price_per_litre=float(fuel_price),
            vehicle_mileage_km_per_litre=float(vehicle_mileage),
            fuel_required_litres=float(fuel_required),
            total_fuel_cost=float(total_cost),
            participant_count=participant_count,
            cost_per_participant=float(cost_per_person),
            estimated_savings_per_participant=float(savings_per_person),
            estimated_fuel_saved_litres=float(fuel_saved),
        )
