from datetime import datetime
from typing import Any
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.fuel_share import FuelShare
from app.models.join_request import JoinRequest
from app.models.payment import Payment
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.join_request import JoinRequestStatus
from app.schemas.payment import PaymentStatus


class ImpactService:
    # Standard environmental coefficient: 1 Litre of fuel = ~2.31 kg CO2 emissions
    CO2_PER_LITRE_KG = 2.31

    @staticmethod
    def get_user_dashboard_impact(db: Session, current_user: User) -> dict[str, Any]:
        """Calculates real, personalized impact metrics for the authenticated user and global platform.
        
        Assumptions & Formulas:
        - Fuel Saved (L): (participant_count - 1) * (trip_distance / vehicle_mileage) for shared trips.
        - CO2 Reduced (kg): Fuel Saved (L) * 2.31 kg/L.
        - Money Saved (₹): Total cost saved by sharing trip vs driving solo.
        """
        # 1. Trips created by user
        my_trips = db.query(FuelShare).filter(FuelShare.creator_id == current_user.id).all()
        my_trip_ids = [t.id for t in my_trips]

        # 2. Joined trips (where user is an accepted passenger)
        my_joined_requests = (
            db.query(JoinRequest)
            .filter(
                JoinRequest.user_id == current_user.id,
                JoinRequest.status == JoinRequestStatus.ACCEPTED.value,
            )
            .all()
        )
        my_joined_trip_ids = [r.fuel_share_id for r in my_joined_requests]

        total_shared_trips = len(my_trips) + len(my_joined_requests)

        # 3. Successful payments made by user
        my_payments = (
            db.query(Payment)
            .filter(
                Payment.user_id == current_user.id,
                Payment.status == PaymentStatus.SUCCESS.value,
            )
            .all()
        )

        # Calculate user monetary savings & environmental metrics
        total_money_saved = 0.0
        total_fuel_saved_litres = 0.0

        all_relevant_trip_ids = list(set(my_trip_ids + my_joined_trip_ids))
        
        for trip_id in all_relevant_trip_ids:
            trip = db.query(FuelShare).filter(FuelShare.id == trip_id).first()
            if not trip:
                continue

            # Count accepted passengers + 1 creator
            accepted_count = (
                db.query(JoinRequest)
                .filter(
                    JoinRequest.fuel_share_id == trip.id,
                    JoinRequest.status == JoinRequestStatus.ACCEPTED.value,
                )
                .count()
            )
            participant_count = 1 + accepted_count

            if participant_count >= 2:
                # Vehicle mileage check
                vehicle = (
                    db.query(Vehicle)
                    .filter(Vehicle.user_id == trip.creator_id)
                    .order_by(Vehicle.created_at.desc())
                    .first()
                )
                mileage = vehicle.mileage if vehicle and vehicle.mileage > 0 else 15.0
                distance = trip.estimated_distance if trip.estimated_distance and trip.estimated_distance > 0 else 30.0
                
                single_fuel = distance / mileage
                shared_fuel_saved = (participant_count - 1) * single_fuel
                total_fuel_saved_litres += shared_fuel_saved

                single_cost = trip.estimated_fuel_cost or (single_fuel * settings.DEFAULT_FUEL_PRICE)
                cost_per_person = single_cost / participant_count
                
                # Savings per participant = (single_cost - cost_per_person)
                user_savings = single_cost - cost_per_person
                total_money_saved += user_savings

        total_co2_reduced_kg = round(total_fuel_saved_litres * ImpactService.CO2_PER_LITRE_KG, 2)
        total_fuel_saved_litres = round(total_fuel_saved_litres, 2)
        total_money_saved = round(total_money_saved, 2)

        # 4. Recent Activity Feed (Chronological events for current user)
        recent_activity: list[dict[str, Any]] = []

        # Created trips
        for trip in sorted(my_trips, key=lambda x: x.created_at, reverse=True)[:3]:
            recent_activity.append({
                "type": "TRIP_OFFERED",
                "title": f"Offered trip to {trip.destination_name}",
                "description": f"From {trip.source_name} • {trip.departure_date} at {trip.departure_time}",
                "timestamp": trip.created_at.isoformat(),
            })

        # Joined requests
        for req in sorted(my_joined_requests, key=lambda x: x.requested_at, reverse=True)[:3]:
            t = db.query(FuelShare).filter(FuelShare.id == req.fuel_share_id).first()
            if t:
                recent_activity.append({
                    "type": "TRIP_JOINED",
                    "title": f"Accepted passenger for {t.destination_name}",
                    "description": f"Trip #{t.id} from {t.source_name}",
                    "timestamp": req.requested_at.isoformat(),
                })

        # Completed payments
        for pay in sorted(my_payments, key=lambda x: x.created_at, reverse=True)[:3]:
            recent_activity.append({
                "type": "PAYMENT_COMPLETED",
                "title": f"Paid ₹{pay.amount:.2f} fuel contribution",
                "description": f"Payment #{pay.id} • Razorpay Ref: {pay.razorpay_payment_id or 'N/A'}",
                "timestamp": pay.created_at.isoformat(),
            })

        # Sort combined activity feed by timestamp descending
        recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)

        return {
            "user_name": current_user.name,
            "metrics": {
                "total_money_saved_rupees": total_money_saved,
                "total_fuel_saved_litres": total_fuel_saved_litres,
                "total_co2_reduced_kg": total_co2_reduced_kg,
                "completed_shared_trips": total_shared_trips,
                "total_participants": len(my_joined_requests) + 1,
            },
            "recent_activity": recent_activity[:5],
        }
