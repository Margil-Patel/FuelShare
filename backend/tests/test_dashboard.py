import datetime
import pytest
from app.models.fuel_share import FuelShare
from app.models.join_request import JoinRequest
from app.models.payment import Payment
from app.models.vehicle import Vehicle
from app.schemas.join_request import JoinRequestStatus
from app.schemas.payment import PaymentStatus


def test_01_unauthenticated_user_cannot_access_dashboard(client):
    response = client.get("/dashboard")
    assert response.status_code == 401


def test_02_new_user_gets_zero_impact_metrics(client, user_a, headers_user_a):
    response = client.get("/dashboard", headers=headers_user_a)
    assert response.status_code == 200
    data = response.json()
    assert data["user_name"] == user_a.name
    assert data["metrics"]["total_money_saved_rupees"] == 0.0
    assert data["metrics"]["total_fuel_saved_litres"] == 0.0
    assert data["metrics"]["total_co2_reduced_kg"] == 0.0
    assert data["metrics"]["completed_shared_trips"] == 0
    assert isinstance(data["recent_activity"], list)


def test_03_shared_trip_calculates_real_impact_metrics(
    client, db_session, user_a, user_b, headers_user_a, headers_user_b
):
    # Add vehicle with mileage 15 km/L
    vehicle = Vehicle(
        user_id=user_a.id,
        vehicle_type="Sedan",
        fuel_type="Petrol",
        mileage=15.0,
        seating_capacity=4,
    )
    db_session.add(vehicle)

    # Create trip: 30km distance, ₹300 estimated cost
    trip = FuelShare(
        creator_id=user_a.id,
        source_name="Ahmedabad Junction",
        source_latitude=23.0225,
        source_longitude=72.5714,
        destination_name="Gandhinagar Bus Station",
        destination_latitude=23.2156,
        destination_longitude=72.6369,
        departure_date=datetime.date.today() + datetime.timedelta(days=1),
        departure_time=datetime.time(9, 0),
        available_seats=2,
        estimated_distance=30.0,
        estimated_fuel_cost=300.0,
        status="ACTIVE",
    )
    db_session.add(trip)
    db_session.commit()

    # User B requests to join and User A accepts
    join_res = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_res.json()["id"]
    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    # Check User A's dashboard
    res_a = client.get("/dashboard", headers=headers_user_a)
    assert res_a.status_code == 200
    metrics_a = res_a.json()["metrics"]
    assert metrics_a["completed_shared_trips"] == 1
    assert metrics_a["total_fuel_saved_litres"] > 0
    assert metrics_a["total_co2_reduced_kg"] > 0
    assert metrics_a["total_money_saved_rupees"] > 0

    # Check User B's dashboard
    res_b = client.get("/dashboard", headers=headers_user_b)
    assert res_b.status_code == 200
    metrics_b = res_b.json()["metrics"]
    assert metrics_b["completed_shared_trips"] == 1
    assert metrics_b["total_fuel_saved_litres"] > 0
