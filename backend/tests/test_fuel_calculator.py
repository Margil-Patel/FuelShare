import datetime
from decimal import Decimal
import pytest
from app.models.fuel_share import FuelShare
from app.models.join_request import JoinRequest
from app.models.vehicle import Vehicle
from app.schemas.join_request import JoinRequestStatus
from app.services.fuel_calculator import FuelCalculatorService


def create_test_vehicle(db_session, user_id, mileage=15.0):
    vehicle = Vehicle(
        user_id=user_id,
        vehicle_type="Car",
        fuel_type="Petrol",
        mileage=mileage,
        seating_capacity=4,
    )
    db_session.add(vehicle)
    db_session.commit()
    db_session.refresh(vehicle)
    return vehicle


def create_test_fuel_share(db_session, creator_id, distance=120.0):
    trip = FuelShare(
        creator_id=creator_id,
        source_name="City Center",
        source_latitude=12.9716,
        source_longitude=77.5946,
        destination_name="Suburbs",
        destination_latitude=13.1986,
        destination_longitude=77.7066,
        departure_date=datetime.date.today() + datetime.timedelta(days=1),
        departure_time=datetime.time(10, 0),
        available_seats=3,
        estimated_distance=distance,
        estimated_fuel_cost=800.0,
        status="ACTIVE",
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)
    return trip


# Unit Tests for Pure Calculator Logic

def test_01_correct_fuel_requirement_calculation():
    req = FuelCalculatorService.calculate_fuel_required(120, 15)
    assert req == Decimal("8.00")


def test_02_correct_total_fuel_cost():
    cost = FuelCalculatorService.calculate_total_fuel_cost(8.0, 100.0)
    assert cost == Decimal("800.00")


def test_03_correct_equal_cost_sharing():
    per_person = FuelCalculatorService.calculate_cost_per_participant(800.0, 4)
    assert per_person == Decimal("200.00")


def test_04_estimated_savings_calculation():
    savings = FuelCalculatorService.calculate_estimated_savings_per_participant(800.0, 200.0)
    assert savings == Decimal("600.00")


def test_05_estimated_fuel_saved_calculation():
    saved = FuelCalculatorService.calculate_estimated_fuel_saved(8.0, 4)
    assert saved == Decimal("24.00")


def test_06_zero_negative_mileage_rejected():
    with pytest.raises(Exception):
        FuelCalculatorService.calculate_fuel_required(120, 0)
    with pytest.raises(Exception):
        FuelCalculatorService.calculate_fuel_required(120, -5)


# API Integration Tests

def test_07_creator_counts_as_participant(client, db_session, user_a, headers_user_a):
    create_test_vehicle(db_session, user_a.id, mileage=15.0)
    trip = create_test_fuel_share(db_session, user_a.id, distance=120.0)

    response = client.get(f"/fuel-shares/{trip.id}/cost", headers=headers_user_a)
    assert response.status_code == 200
    data = response.json()
    assert data["participant_count"] == 1
    assert data["fuel_required_litres"] == 8.0
    assert data["total_fuel_cost"] == 800.0
    assert data["cost_per_participant"] == 800.0
    assert data["estimated_savings_per_participant"] == 0.0


def test_08_accepted_participants_are_counted(client, db_session, user_a, user_b, headers_user_a, headers_user_b):
    create_test_vehicle(db_session, user_a.id, mileage=15.0)
    trip = create_test_fuel_share(db_session, user_a.id, distance=120.0)

    # User B requests & Creator A accepts
    join_resp = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_resp.json()["id"]
    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    # Cost response for creator A
    resp_a = client.get(f"/fuel-shares/{trip.id}/cost", headers=headers_user_a)
    assert resp_a.status_code == 200
    data_a = resp_a.json()
    assert data_a["participant_count"] == 2
    assert data_a["cost_per_participant"] == 400.0
    assert data_a["estimated_savings_per_participant"] == 400.0

    # Accepted participant B can also access cost details
    resp_b = client.get(f"/fuel-shares/{trip.id}/cost", headers=headers_user_b)
    assert resp_b.status_code == 200
    assert resp_b.json()["participant_count"] == 2


def test_09_pending_rejected_cancelled_requests_not_counted(client, db_session, user_a, user_b, user_c, headers_user_a, headers_user_b, headers_user_c):
    create_test_vehicle(db_session, user_a.id, mileage=15.0)
    trip = create_test_fuel_share(db_session, user_a.id, distance=120.0)

    # User B pending request (not accepted)
    client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)

    response = client.get(f"/fuel-shares/{trip.id}/cost", headers=headers_user_a)
    assert response.status_code == 200
    # Only creator counts (1)
    assert response.json()["participant_count"] == 1


def test_10_missing_vehicle_handled_correctly(client, db_session, user_a, headers_user_a):
    # Trip created by User A without registering a vehicle
    trip = create_test_fuel_share(db_session, user_a.id, distance=120.0)

    response = client.get(f"/fuel-shares/{trip.id}/cost", headers=headers_user_a)
    assert response.status_code == 400
    assert "No vehicle registered" in response.json()["detail"]


def test_11_zero_mileage_vehicle_handled_correctly(client, db_session, user_a, headers_user_a):
    create_test_vehicle(db_session, user_a.id, mileage=0.0)
    trip = create_test_fuel_share(db_session, user_a.id, distance=120.0)

    response = client.get(f"/fuel-shares/{trip.id}/cost", headers=headers_user_a)
    assert response.status_code == 400
    assert "greater than zero" in response.json()["detail"]


def test_12_missing_distance_automatically_recalculated(client, db_session, user_a, headers_user_a):
    create_test_vehicle(db_session, user_a.id, mileage=10.0)
    # Trip with 0 estimated_distance
    trip = create_test_fuel_share(db_session, user_a.id, distance=0.0)

    response = client.get(f"/fuel-shares/{trip.id}/cost", headers=headers_user_a)
    assert response.status_code == 200
    data = response.json()
    assert data["distance_km"] > 0


def test_13_fuel_price_configuration_and_query_override(client, db_session, user_a, headers_user_a):
    create_test_vehicle(db_session, user_a.id, mileage=10.0)
    trip = create_test_fuel_share(db_session, user_a.id, distance=100.0)

    # Default fuel price (100.0)
    resp_default = client.get(f"/fuel-shares/{trip.id}/cost", headers=headers_user_a)
    assert resp_default.status_code == 200
    assert resp_default.json()["fuel_price_per_litre"] == 100.0
    assert resp_default.json()["total_fuel_cost"] == 1000.0

    # Custom fuel price query parameter (150.0)
    resp_custom = client.get(f"/fuel-shares/{trip.id}/cost?fuel_price=150.0", headers=headers_user_a)
    assert resp_custom.status_code == 200
    assert resp_custom.json()["fuel_price_per_litre"] == 150.0
    assert resp_custom.json()["total_fuel_cost"] == 1500.0


def test_14_unauthorized_users_cannot_access_cost_info(client, db_session, user_a, user_b, headers_user_b):
    create_test_vehicle(db_session, user_a.id, mileage=15.0)
    trip = create_test_fuel_share(db_session, user_a.id, distance=120.0)

    # User B is NOT accepted (no request sent)
    response = client.get(f"/fuel-shares/{trip.id}/cost", headers=headers_user_b)
    assert response.status_code == 403
    assert "Not authorized" in response.json()["detail"]
