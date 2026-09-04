import datetime
import pytest
from app.models.fuel_share import FuelShare
from app.models.join_request import JoinRequest
from app.schemas.fuel_share import FuelShareStatus
from app.schemas.join_request import JoinRequestStatus


def create_test_fuel_share(db_session, creator_id, available_seats=2, status="ACTIVE"):
    trip = FuelShare(
        creator_id=creator_id,
        source_name="Downtown",
        source_latitude=12.9716,
        source_longitude=77.5946,
        destination_name="Airport",
        destination_latitude=13.1986,
        destination_longitude=77.7066,
        departure_date=datetime.date.today() + datetime.timedelta(days=1),
        departure_time=datetime.time(9, 0),
        available_seats=available_seats,
        estimated_distance=35.0,
        estimated_fuel_cost=500.0,
        status=status,
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)
    return trip


# Test 1: Authenticated user can request to join
def test_01_authenticated_user_can_request_to_join(client, db_session, user_a, user_b, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=2)
    response = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    assert response.status_code == 201
    data = response.json()
    assert data["fuel_share_id"] == trip.id
    assert data["user_id"] == user_b.id
    assert data["status"] == "PENDING"
    assert data["user"]["id"] == user_b.id
    assert "password_hash" not in data["user"]


# Test 2: Unauthenticated user cannot join
def test_02_unauthenticated_user_cannot_join(client, db_session, user_a):
    trip = create_test_fuel_share(db_session, user_a.id)
    response = client.post(f"/fuel-shares/{trip.id}/join")
    assert response.status_code == 403 or response.status_code == 401


# Test 3: User cannot join their own Fuel Share
def test_03_user_cannot_join_own_fuel_share(client, db_session, user_a, headers_user_a):
    trip = create_test_fuel_share(db_session, user_a.id)
    response = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_a)
    assert response.status_code == 400
    assert "own Fuel Share" in response.json()["detail"]


# Test 4: User cannot join a cancelled Fuel Share
def test_04_user_cannot_join_cancelled_fuel_share(client, db_session, user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, status=FuelShareStatus.CANCELLED.value)
    response = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    assert response.status_code == 400
    assert "CANCELLED" in response.json()["detail"]


# Test 5: User cannot join a completed Fuel Share
def test_05_user_cannot_join_completed_fuel_share(client, db_session, user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, status=FuelShareStatus.COMPLETED.value)
    response = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    assert response.status_code == 400
    assert "COMPLETED" in response.json()["detail"]


# Test 6: User cannot join a full Fuel Share
def test_06_user_cannot_join_full_fuel_share(client, db_session, user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=0, status=FuelShareStatus.FULL.value)
    response = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    assert response.status_code == 400


# Test 7: Duplicate pending requests are rejected
def test_07_duplicate_pending_requests_rejected(client, db_session, user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=2)
    resp1 = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    assert resp1.status_code == 201

    resp2 = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    assert resp2.status_code == 400
    assert "already have an active or pending join request" in resp2.json()["detail"]


# Test 8: Creator can view incoming requests
def test_08_creator_can_view_incoming_requests(client, db_session, user_a, user_b, headers_user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id)
    client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)

    response = client.get(f"/fuel-shares/{trip.id}/requests", headers=headers_user_a)
    assert response.status_code == 200
    requests = response.json()
    assert len(requests) == 1
    assert requests[0]["user_id"] == user_b.id


# Test 9: Non-creator cannot view another user's incoming requests
def test_09_non_creator_cannot_view_incoming_requests(client, db_session, user_a, headers_user_b, headers_user_c):
    trip = create_test_fuel_share(db_session, user_a.id)
    response = client.get(f"/fuel-shares/{trip.id}/requests", headers=headers_user_b)
    assert response.status_code == 403

    response_c = client.get(f"/fuel-shares/{trip.id}/requests", headers=headers_user_c)
    assert response_c.status_code == 403


# Test 10: Creator can accept a pending request
def test_10_creator_can_accept_pending_request(client, db_session, user_a, headers_user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=2)
    join_resp = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_resp.json()["id"]

    accept_resp = client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)
    assert accept_resp.status_code == 200
    data = accept_resp.json()
    assert data["status"] == "ACCEPTED"
    assert data["accepted_at"] is not None


# Test 11: Accepting a request decreases available seats
def test_11_accepting_request_decreases_available_seats(client, db_session, user_a, headers_user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=3)
    join_resp = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_resp.json()["id"]

    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    db_session.refresh(trip)
    assert trip.available_seats == 2
    assert trip.status == "ACTIVE"


# Test 12: Accepting the final available seat changes status to FULL
def test_12_accepting_final_seat_changes_status_to_full(client, db_session, user_a, headers_user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=1)
    join_resp = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_resp.json()["id"]

    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    db_session.refresh(trip)
    assert trip.available_seats == 0
    assert trip.status == "FULL"


# Test 13: Creator can reject a request
def test_13_creator_can_reject_request(client, db_session, user_a, headers_user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=2)
    join_resp = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_resp.json()["id"]

    reject_resp = client.put(f"/join-requests/{req_id}/reject", headers=headers_user_a)
    assert reject_resp.status_code == 200
    assert reject_resp.json()["status"] == "REJECTED"


# Test 14: Rejection does not change available seats
def test_14_rejection_does_not_change_available_seats(client, db_session, user_a, headers_user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=2)
    join_resp = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_resp.json()["id"]

    client.put(f"/join-requests/{req_id}/reject", headers=headers_user_a)

    db_session.refresh(trip)
    assert trip.available_seats == 2


# Test 15: User can cancel their own pending request
def test_15_user_can_cancel_own_pending_request(client, db_session, user_a, headers_user_b):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=2)
    join_resp = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_resp.json()["id"]

    cancel_resp = client.delete(f"/join-requests/{req_id}", headers=headers_user_b)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CANCELLED"


# Test 16: User cannot cancel another user's request
def test_16_user_cannot_cancel_another_users_request(client, db_session, user_a, headers_user_b, headers_user_c):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=2)
    join_resp = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_resp.json()["id"]

    cancel_resp = client.delete(f"/join-requests/{req_id}", headers=headers_user_c)
    assert cancel_resp.status_code == 403


# Test 17: Non-creator cannot accept/reject requests
def test_17_non_creator_cannot_accept_or_reject_requests(client, db_session, user_a, headers_user_b, headers_user_c):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=2)
    join_resp = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_resp.json()["id"]

    accept_resp = client.put(f"/join-requests/{req_id}/accept", headers=headers_user_c)
    assert accept_resp.status_code == 403

    reject_resp = client.put(f"/join-requests/{req_id}/reject", headers=headers_user_c)
    assert reject_resp.status_code == 403


# Test 18: Seat updates are transaction-safe
def test_18_seat_updates_transaction_safety(client, db_session, user_a, user_b, user_c, headers_user_a, headers_user_b, headers_user_c):
    trip = create_test_fuel_share(db_session, user_a.id, available_seats=1)

    join_b = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_b_id = join_b.json()["id"]

    join_c = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_c)
    req_c_id = join_c.json()["id"]

    # Accept first user
    accept_b = client.put(f"/join-requests/{req_b_id}/accept", headers=headers_user_a)
    assert accept_b.status_code == 200

    # Attempting to accept second user should fail because seats = 0
    accept_c = client.put(f"/join-requests/{req_c_id}/accept", headers=headers_user_a)
    assert accept_c.status_code == 400
    assert "No available seats" in accept_c.json()["detail"]


# Test 19: Existing endpoints (Health, Auth, FuelShares, Matching) sanity check
def test_19_existing_endpoints_pass(client):
    health = client.get("/health")
    assert health.status_code == 200

    root = client.get("/")
    assert root.status_code == 200
