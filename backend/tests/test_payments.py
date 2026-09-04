import datetime
import hmac
import hashlib
import pytest
from app.core.config import settings
from app.models.fuel_share import FuelShare
from app.models.payment import Payment
from app.models.vehicle import Vehicle
from app.schemas.payment import PaymentStatus


def create_test_fuel_share(db_session, creator_id, available_seats=2, estimated_fuel_cost=500.0, status="ACTIVE"):
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
        estimated_fuel_cost=estimated_fuel_cost,
        status=status,
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)
    return trip


def create_test_vehicle(db_session, user_id, mileage=15.0):
    vehicle = Vehicle(
        user_id=user_id,
        vehicle_type="Sedan",
        fuel_type="Petrol",
        mileage=mileage,
        seating_capacity=4,
    )
    db_session.add(vehicle)
    db_session.commit()
    db_session.refresh(vehicle)
    return vehicle


def test_01_unauthenticated_user_cannot_create_payment_order(client):
    response = client.post("/payments/create-order", json={"fuel_share_id": 1})
    assert response.status_code == 401


def test_02_non_participant_cannot_create_payment(
    client, db_session, user_a, user_b, headers_user_b
):
    trip = create_test_fuel_share(db_session, user_a.id)
    response = client.post(
        "/payments/create-order",
        headers=headers_user_b,
        json={"fuel_share_id": trip.id},
    )
    assert response.status_code == 403


def test_03_pending_join_request_cannot_create_payment(
    client, db_session, user_a, user_b, headers_user_b
):
    trip = create_test_fuel_share(db_session, user_a.id)
    client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)

    response = client.post(
        "/payments/create-order",
        headers=headers_user_b,
        json={"fuel_share_id": trip.id},
    )
    assert response.status_code == 403


def test_04_accepted_participant_can_create_payment_order(
    client, db_session, user_a, user_b, headers_user_a, headers_user_b
):
    create_test_vehicle(db_session, user_a.id, mileage=15.0)
    trip = create_test_fuel_share(db_session, user_a.id, estimated_fuel_cost=300.0)

    join_res = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_res.json()["id"]

    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    response = client.post(
        "/payments/create-order",
        headers=headers_user_b,
        json={"fuel_share_id": trip.id},
    )

    print("DEBUG_RESP:", response.status_code, response.text)
    assert response.status_code == 201
    data = response.json()
    assert "order_id" in data
    assert data["currency"] == "INR"
    assert data["amount_paise"] > 0

    # Verify payment record in DB is PENDING
    payment_db = (
        db_session.query(Payment)
        .filter(Payment.razorpay_order_id == data["order_id"])
        .first()
    )
    assert payment_db is not None
    assert payment_db.status == PaymentStatus.PENDING.value
    assert payment_db.user_id == user_b.id


def test_05_valid_signature_verification_succeeds(
    client, db_session, user_a, user_b, headers_user_a, headers_user_b
):
    trip = create_test_fuel_share(db_session, user_a.id, estimated_fuel_cost=200.0)
    join_res = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_res.json()["id"]
    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    order_res = client.post(
        "/payments/create-order",
        headers=headers_user_b,
        json={"fuel_share_id": trip.id},
    )
    order_id = order_res.json()["order_id"]
    payment_id = "pay_test_999"

    # Compute HMAC-SHA256 signature
    signature = hmac.new(
        key=settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        msg=f"{order_id}|{payment_id}".encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    verify_res = client.post(
        "/payments/verify",
        headers=headers_user_b,
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        },
    )

    assert verify_res.status_code == 200
    vdata = verify_res.json()
    assert vdata["status"] == PaymentStatus.SUCCESS.value
    assert vdata["razorpay_payment_id"] == payment_id


def test_06_invalid_signature_is_rejected(
    client, db_session, user_a, user_b, headers_user_a, headers_user_b
):
    trip = create_test_fuel_share(db_session, user_a.id)
    join_res = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_res.json()["id"]
    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    order_res = client.post(
        "/payments/create-order",
        headers=headers_user_b,
        json={"fuel_share_id": trip.id},
    )
    order_id = order_res.json()["order_id"]

    verify_res = client.post(
        "/payments/verify",
        headers=headers_user_b,
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": "pay_fake_000",
            "razorpay_signature": "invalid_signature_string_here",
        },
    )

    assert verify_res.status_code == 400


def test_07_duplicate_verification_is_idempotent(
    client, db_session, user_a, user_b, headers_user_a, headers_user_b
):
    trip = create_test_fuel_share(db_session, user_a.id)
    join_res = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_res.json()["id"]
    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    order_res = client.post(
        "/payments/create-order",
        headers=headers_user_b,
        json={"fuel_share_id": trip.id},
    )
    order_id = order_res.json()["order_id"]
    payment_id = "pay_test_idem_1"

    signature = hmac.new(
        key=settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        msg=f"{order_id}|{payment_id}".encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    # First verification
    res1 = client.post(
        "/payments/verify",
        headers=headers_user_b,
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        },
    )
    assert res1.status_code == 200

    # Second verification (idempotent)
    res2 = client.post(
        "/payments/verify",
        headers=headers_user_b,
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature,
        },
    )
    assert res2.status_code == 200
    assert res2.json()["status"] == PaymentStatus.SUCCESS.value


def test_08_already_paid_user_cannot_create_new_order(
    client, db_session, user_a, user_b, headers_user_a, headers_user_b
):
    trip = create_test_fuel_share(db_session, user_a.id)
    join_res = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_res.json()["id"]
    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    order_res = client.post(
        "/payments/create-order",
        headers=headers_user_b,
        json={"fuel_share_id": trip.id},
    )
    order_id = order_res.json()["order_id"]

    signature = hmac.new(
        key=settings.RAZORPAY_KEY_SECRET.encode("utf-8"),
        msg=f"{order_id}|pay_test_once".encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    client.post(
        "/payments/verify",
        headers=headers_user_b,
        json={
            "razorpay_order_id": order_id,
            "razorpay_payment_id": "pay_test_once",
            "razorpay_signature": signature,
        },
    )

    # Attempt to create order again after success
    order_again = client.post(
        "/payments/create-order",
        headers=headers_user_b,
        json={"fuel_share_id": trip.id},
    )
    assert order_again.status_code == 400


def test_09_user_can_get_payment_details(
    client, db_session, user_a, user_b, headers_user_a, headers_user_b, headers_user_c
):
    trip = create_test_fuel_share(db_session, user_a.id)
    join_res = client.post(f"/fuel-shares/{trip.id}/join", headers=headers_user_b)
    req_id = join_res.json()["id"]
    client.put(f"/join-requests/{req_id}/accept", headers=headers_user_a)

    order_res = client.post(
        "/payments/create-order",
        headers=headers_user_b,
        json={"fuel_share_id": trip.id},
    )
    pay_db_id = order_res.json()["payment_id"]

    # Owner user_b can view payment
    get_res = client.get(f"/payments/{pay_db_id}", headers=headers_user_b)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == pay_db_id

    # Unrelated user_c cannot view payment
    get_unauth = client.get(f"/payments/{pay_db_id}", headers=headers_user_c)
    assert get_unauth.status_code == 403
