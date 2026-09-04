"""
Unit and integration tests for the corridor-based matching engine.

Covers:
  - Polyline encode/decode round-trip
  - point_to_segment_distance_m accuracy
  - locate_point_on_polyline ordering
  - min_distance_to_polyline_m buffer boundary
  - Corridor algorithm: buffer pass/fail
  - Corridor algorithm: direction check (C before D)
  - Corridor algorithm: detour rejection (absolute + proportional)
  - Time window filtering
  - Seat availability filtering
  - Fare calculation: proportional vs even-split strategies
  - API endpoint smoke tests
"""
import datetime
import math
import pytest

from app.services.polyline_utils import (
    decode_polyline,
    encode_polyline,
    locate_point_on_polyline,
    min_distance_to_polyline_m,
    point_to_segment_distance_m,
)
from app.services.fare_calculator import (
    DistanceProportionalStrategy,
    EvenSplitStrategy,
    get_fare_strategy,
)
from app.services.corridor_matching_service import CorridorMatchingService
from app.models.fuel_share import FuelShare
from app.models.ride_request import RideRequest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_fuel_share(
    creator_id: int,
    src_lat: float,
    src_lon: float,
    dst_lat: float,
    dst_lon: float,
    polyline: str = "",
    distance_km: float = 30.0,
    fuel_cost: float = 300.0,
    seats: int = 2,
    dep_time: datetime.datetime | None = None,
    db=None,
) -> FuelShare:
    if dep_time is None:
        dep_time = datetime.datetime.now() + datetime.timedelta(hours=2)

    if not polyline:
        polyline = encode_polyline([(src_lat, src_lon), (dst_lat, dst_lon)])

    trip = FuelShare(
        creator_id=creator_id,
        source_name="Origin",
        source_latitude=src_lat,
        source_longitude=src_lon,
        destination_name="Destination",
        destination_latitude=dst_lat,
        destination_longitude=dst_lon,
        departure_date=dep_time.date(),
        departure_time=dep_time.time(),
        available_seats=seats,
        estimated_distance=distance_km,
        estimated_fuel_cost=fuel_cost,
        route_polyline=polyline,
        status="ACTIVE",
    )
    if db:
        db.add(trip)
        db.commit()
        db.refresh(trip)
    return trip


def make_ride_request(
    passenger_id: int,
    pickup_lat: float,
    pickup_lon: float,
    drop_lat: float,
    drop_lon: float,
    desired: datetime.datetime | None = None,
    seats_needed: int = 1,
    db=None,
) -> RideRequest:
    if desired is None:
        desired = datetime.datetime.now() + datetime.timedelta(hours=2)

    req = RideRequest(
        passenger_id=passenger_id,
        pickup_name="Pickup",
        pickup_latitude=pickup_lat,
        pickup_longitude=pickup_lon,
        drop_name="Drop",
        drop_latitude=drop_lat,
        drop_longitude=drop_lon,
        desired_departure=desired,
        seats_needed=seats_needed,
        status="OPEN",
    )
    if db:
        db.add(req)
        db.commit()
        db.refresh(req)
    return req


# ---------------------------------------------------------------------------
# 1. Polyline codec round-trip
# ---------------------------------------------------------------------------

def test_01_polyline_encode_decode_round_trip():
    coords = [(23.0225, 72.5714), (23.1000, 72.6000), (23.2156, 72.6369)]
    encoded = encode_polyline(coords)
    decoded = decode_polyline(encoded)
    assert len(decoded) == len(coords)
    for (lat, lon), (dlat, dlon) in zip(coords, decoded):
        assert abs(lat - dlat) < 1e-4
        assert abs(lon - dlon) < 1e-4


def test_02_polyline_single_segment():
    coords = [(12.9716, 77.5946), (13.0827, 80.2707)]
    encoded = encode_polyline(coords)
    decoded = decode_polyline(encoded)
    assert len(decoded) == 2
    assert abs(decoded[0][0] - 12.9716) < 1e-4


# ---------------------------------------------------------------------------
# 2. Segment distance geometry
# ---------------------------------------------------------------------------

def test_03_point_on_segment_midpoint_distance_near_zero():
    """A point exactly on the segment midpoint should have ~0 m distance."""
    seg_a = (23.0, 72.5)
    seg_b = (23.1, 72.6)
    midpoint = ((seg_a[0] + seg_b[0]) / 2, (seg_a[1] + seg_b[1]) / 2)
    dist = point_to_segment_distance_m(midpoint, seg_a, seg_b)
    assert dist < 20.0  # within 20 m (float rounding)


def test_04_point_perpendicular_to_segment():
    """A point offset perpendicular to a horizontal segment."""
    # Horizontal segment along lat=23.0
    seg_a = (23.0, 72.0)
    seg_b = (23.0, 73.0)
    # Point 0.01° north ≈ ~1111 m above midpoint
    pt = (23.01, 72.5)
    dist = point_to_segment_distance_m(pt, seg_a, seg_b)
    # 0.01° lat ≈ 1111 m
    assert 1000 < dist < 1300


def test_05_point_beyond_segment_end_clamps_to_endpoint():
    """Point past segment end should give distance to endpoint, not extrapolated."""
    seg_a = (23.0, 72.0)
    seg_b = (23.0, 72.1)
    pt_past = (23.0, 73.0)  # far past seg_b
    dist = point_to_segment_distance_m(pt_past, seg_a, seg_b)
    dist_to_b = point_to_segment_distance_m(seg_b, seg_a, seg_b)  # ~0
    dist_b_direct = point_to_segment_distance_m(pt_past, seg_b, seg_b)
    # Should match distance from pt to seg_b endpoint
    assert abs(dist - dist_b_direct) < 50  # within 50 m


# ---------------------------------------------------------------------------
# 3. locate_point_on_polyline ordering
# ---------------------------------------------------------------------------

def test_06_polyline_fraction_start_is_zero():
    polyline = [(23.0, 72.0), (23.1, 72.1), (23.2, 72.2)]
    frac = locate_point_on_polyline((23.0, 72.0), polyline)
    assert frac < 0.05


def test_07_polyline_fraction_end_is_one():
    polyline = [(23.0, 72.0), (23.1, 72.1), (23.2, 72.2)]
    frac = locate_point_on_polyline((23.2, 72.2), polyline)
    assert frac > 0.95


def test_08_polyline_fraction_ordering_preserved():
    """A point closer to start must have smaller fraction than a point closer to end."""
    polyline = [(23.0, 72.0), (23.1, 72.1), (23.2, 72.2)]
    frac_start = locate_point_on_polyline((23.02, 72.02), polyline)
    frac_end = locate_point_on_polyline((23.18, 72.18), polyline)
    assert frac_start < frac_end


# ---------------------------------------------------------------------------
# 4. Buffer boundary
# ---------------------------------------------------------------------------

def test_09_point_within_buffer_accepted(user_a, db_session):
    """A pickup point within 500 m of route should pass the buffer check."""
    # A→B: roughly south to north along lon=72.57
    polyline = encode_polyline([(23.00, 72.57), (23.10, 72.57), (23.22, 72.57)])
    trip = make_fuel_share(
        creator_id=user_a.id,
        src_lat=23.00, src_lon=72.57,
        dst_lat=23.22, dst_lon=72.57,
        polyline=polyline,
        db=db_session,
    )
    # Pickup ~200 m east of the polyline at lat=23.10
    req = make_ride_request(
        passenger_id=user_a.id + 1,
        pickup_lat=23.10, pickup_lon=72.572,  # ~200 m east
        drop_lat=23.18, drop_lon=72.572,
        db=db_session,
    )
    dist = min_distance_to_polyline_m(
        (req.pickup_latitude, req.pickup_longitude),
        decode_polyline(polyline),
    )
    assert dist < 500


def test_10_point_outside_buffer_rejected():
    """A pickup point > 500 m from route must fail the buffer check."""
    polyline = encode_polyline([(23.00, 72.57), (23.22, 72.57)])
    coords = decode_polyline(polyline)
    # Point 1 km east (lon +0.01 ≈ 1 km at lat 23)
    far_point = (23.10, 72.58)
    dist = min_distance_to_polyline_m(far_point, coords)
    assert dist > 500


# ---------------------------------------------------------------------------
# 5. Direction check (C before D)
# ---------------------------------------------------------------------------

def test_11_correct_direction_passes(user_a, db_session):
    """C before D along the route → match should succeed direction check."""
    polyline = encode_polyline([(23.00, 72.5), (23.10, 72.5), (23.20, 72.5)])
    coords = decode_polyline(polyline)
    C = (23.05, 72.5)
    D = (23.15, 72.5)
    frac_c = locate_point_on_polyline(C, coords)
    frac_d = locate_point_on_polyline(D, coords)
    assert frac_c < frac_d, "C should come before D along route"


def test_12_reversed_direction_fails():
    """D before C (reversed) → frac_c >= frac_d, direction check fails."""
    polyline = encode_polyline([(23.00, 72.5), (23.10, 72.5), (23.20, 72.5)])
    coords = decode_polyline(polyline)
    C = (23.15, 72.5)  # near end
    D = (23.05, 72.5)  # near start
    frac_c = locate_point_on_polyline(C, coords)
    frac_d = locate_point_on_polyline(D, coords)
    assert frac_c > frac_d, "Reversed request must fail direction check"


# ---------------------------------------------------------------------------
# 6. Detour rejection
# ---------------------------------------------------------------------------

def test_13_detour_within_threshold_accepted(user_a, user_b, db_session):
    """Small detour (< 2 km) → match is accepted."""
    polyline = encode_polyline([(23.00, 72.5), (23.22, 72.5)])
    trip = make_fuel_share(
        creator_id=user_a.id,
        src_lat=23.00, src_lon=72.5,
        dst_lat=23.22, dst_lon=72.5,
        polyline=polyline,
        distance_km=25.0,
        fuel_cost=250.0,
        db=db_session,
    )
    # Request almost exactly on the route (tiny detour)
    req = make_ride_request(
        passenger_id=user_b.id,
        pickup_lat=23.05, pickup_lon=72.5,
        drop_lat=23.18, drop_lon=72.5,
        db=db_session,
    )
    result = CorridorMatchingService._run_corridor_check(trip, req, 500, 2.0, 0.15)
    assert result is not None, "Small detour should yield a match"


def test_14_detour_exceeds_absolute_threshold_rejected(user_a, user_b, db_session):
    """Detour > 2 km → match rejected regardless of % threshold."""
    # Short route A→B (10 km)
    polyline = encode_polyline([(23.00, 72.5), (23.09, 72.5)])
    trip = make_fuel_share(
        creator_id=user_a.id,
        src_lat=23.00, src_lon=72.5,
        dst_lat=23.09, dst_lon=72.5,
        polyline=polyline,
        distance_km=10.0,
        fuel_cost=100.0,
        db=db_session,
    )
    # Passenger pickup 3 km off-route → detour > 2 km
    req = make_ride_request(
        passenger_id=user_b.id,
        pickup_lat=23.04, pickup_lon=72.53,   # ~3 km east
        drop_lat=23.07, drop_lon=72.53,
        db=db_session,
    )
    result = CorridorMatchingService._run_corridor_check(trip, req, 5000, 2.0, 0.15)
    assert result is None, "Detour > 2 km should be rejected"


def test_15_detour_exceeds_percentage_threshold_rejected(user_a, user_b, db_session):
    """Detour > 15% of route → rejected even if < 2 km absolute."""
    # Very short route: 5 km north
    polyline = encode_polyline([(23.00, 72.50), (23.045, 72.50)])
    trip = make_fuel_share(
        creator_id=user_a.id,
        src_lat=23.00, src_lon=72.50,
        dst_lat=23.045, dst_lon=72.50,
        polyline=polyline,
        distance_km=5.0,
        fuel_cost=50.0,
        db=db_session,
    )
    # 15% of 5 km = 0.75 km threshold.
    # Pickup 1.3 km east (lon +0.013° ≈ 1.3 km at lat 23°) → detour ~1.3 km > 0.75 km
    req = make_ride_request(
        passenger_id=user_b.id,
        pickup_lat=23.02, pickup_lon=72.513,   # ~1.3 km east
        drop_lat=23.03, drop_lon=72.513,
        db=db_session,
    )
    result = CorridorMatchingService._run_corridor_check(trip, req, 5000, 2.0, 0.15)
    # Detour (~1.3 km) > min(2 km, 0.15×5 km=0.75 km) → rejected
    assert result is None, "Detour > 15% of short route should be rejected"


# ---------------------------------------------------------------------------
# 7. Time window filtering
# ---------------------------------------------------------------------------

def test_16_time_window_excluded(user_a, user_b, db_session):
    """Ride and request > 30 min apart must not appear in results."""
    now = datetime.datetime.now()
    dep = now + datetime.timedelta(hours=2)

    trip = make_fuel_share(
        creator_id=user_a.id,
        src_lat=23.00, src_lon=72.5,
        dst_lat=23.22, dst_lon=72.5,
        dep_time=dep,
        distance_km=25.0,
        fuel_cost=250.0,
        db=db_session,
    )
    # Passenger wants departure 2 hours before the rider
    req = make_ride_request(
        passenger_id=user_b.id,
        pickup_lat=23.05, pickup_lon=72.5,
        drop_lat=23.18, drop_lon=72.5,
        desired=dep - datetime.timedelta(hours=2),
        db=db_session,
    )
    results = CorridorMatchingService.find_corridor_matches_for_request(
        db=db_session,
        current_user=user_b,
        ride_request_id=req.id,
        buffer_m=500,
        detour_max_km=2.0,
        detour_max_pct=0.15,
        time_window_minutes=30,
    )
    assert len(results) == 0, "Ride outside time window should not match"


# ---------------------------------------------------------------------------
# 8. Seat availability filtering
# ---------------------------------------------------------------------------

def test_17_no_seats_excluded(user_a, user_b, db_session):
    """Ride with 0 available seats must not appear in results."""
    dep = datetime.datetime.now() + datetime.timedelta(hours=2)
    trip = make_fuel_share(
        creator_id=user_a.id,
        src_lat=23.00, src_lon=72.5,
        dst_lat=23.22, dst_lon=72.5,
        dep_time=dep,
        seats=0,   # No seats
        distance_km=25.0,
        fuel_cost=250.0,
        db=db_session,
    )
    req = make_ride_request(
        passenger_id=user_b.id,
        pickup_lat=23.05, pickup_lon=72.5,
        drop_lat=23.18, drop_lon=72.5,
        desired=dep,
        db=db_session,
    )
    results = CorridorMatchingService.find_corridor_matches_for_request(
        db=db_session,
        current_user=user_b,
        ride_request_id=req.id,
    )
    assert len(results) == 0, "Ride with 0 seats should not match"


# ---------------------------------------------------------------------------
# 9. Fare calculation strategies
# ---------------------------------------------------------------------------

def test_18_proportional_fare_calculation():
    strategy = DistanceProportionalStrategy()
    # Passenger travels 10 km out of 40 km total. Total cost = ₹400.
    fare = strategy.calculate(
        passenger_distance_km=10.0,
        total_distance_km=40.0,
        total_fuel_cost=400.0,
        n_passengers=1,
    )
    assert fare == pytest.approx(100.0, abs=0.01)  # 10/40 * 400 = ₹100


def test_19_even_split_fare_calculation():
    strategy = EvenSplitStrategy()
    # 4 passengers, total cost ₹400 → ₹100 each
    fare = strategy.calculate(
        passenger_distance_km=10.0,
        total_distance_km=40.0,
        total_fuel_cost=400.0,
        n_passengers=4,
    )
    assert fare == pytest.approx(100.0, abs=0.01)


def test_20_get_fare_strategy_by_name():
    assert isinstance(get_fare_strategy("proportional"), DistanceProportionalStrategy)
    assert isinstance(get_fare_strategy("even"), EvenSplitStrategy)
    # Unknown falls back to proportional
    assert isinstance(get_fare_strategy("unknown_xyz"), DistanceProportionalStrategy)


def test_21_proportional_fare_capped_at_100pct():
    strategy = DistanceProportionalStrategy()
    # Passenger distance > total (shouldn't happen but should be safe)
    fare = strategy.calculate(
        passenger_distance_km=50.0,
        total_distance_km=40.0,
        total_fuel_cost=400.0,
        n_passengers=1,
    )
    assert fare <= 400.0  # capped at 100%


# ---------------------------------------------------------------------------
# 10. API endpoint smoke tests
# ---------------------------------------------------------------------------

def test_22_create_ride_request_api(client, user_a, headers_user_a):
    dep_str = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
    resp = client.post("/ride-requests", headers=headers_user_a, json={
        "pickup_name": "Bopal",
        "pickup_latitude": 23.03,
        "pickup_longitude": 72.47,
        "drop_name": "SG Highway",
        "drop_latitude": 23.04,
        "drop_longitude": 72.50,
        "desired_departure": dep_str,
        "seats_needed": 1,
    })
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["pickup_name"] == "Bopal"
    assert data["status"] == "OPEN"


def test_23_get_my_ride_requests_api(client, user_a, headers_user_a):
    dep_str = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
    client.post("/ride-requests", headers=headers_user_a, json={
        "pickup_name": "Bopal",
        "pickup_latitude": 23.03,
        "pickup_longitude": 72.47,
        "drop_name": "SG Highway",
        "drop_latitude": 23.04,
        "drop_longitude": 72.50,
        "desired_departure": dep_str,
    })
    resp = client.get("/ride-requests/me", headers=headers_user_a)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_24_cancel_ride_request_api(client, user_a, headers_user_a):
    dep_str = (datetime.datetime.now() + datetime.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%S")
    create_resp = client.post("/ride-requests", headers=headers_user_a, json={
        "pickup_name": "X",
        "pickup_latitude": 23.00,
        "pickup_longitude": 72.40,
        "drop_name": "Y",
        "drop_latitude": 23.05,
        "drop_longitude": 72.45,
        "desired_departure": dep_str,
    })
    req_id = create_resp.json()["id"]
    cancel_resp = client.delete(f"/ride-requests/{req_id}", headers=headers_user_a)
    assert cancel_resp.status_code == 200
    assert cancel_resp.json()["status"] == "CANCELLED"


def test_25_corridor_matches_endpoint_returns_list(client, user_a, user_b, headers_user_a, headers_user_b, db_session):
    """corridor-matches endpoint returns a valid CorridorMatchListResponse."""
    dep = datetime.datetime.now() + datetime.timedelta(hours=3)
    dep_str = dep.strftime("%Y-%m-%dT%H:%M:%S")

    # Create a fuel share for user_a
    fs_resp = client.post("/fuel-shares", headers=headers_user_a, json={
        "source_name": "Origin",
        "source_latitude": 23.00,
        "source_longitude": 72.5,
        "destination_name": "Destination",
        "destination_latitude": 23.22,
        "destination_longitude": 72.5,
        "departure_date": dep.date().isoformat(),
        "departure_time": dep.time().strftime("%H:%M:%S"),
        "available_seats": 2,
    })
    assert fs_resp.status_code == 201

    # Create a ride request for user_b
    rr_resp = client.post("/ride-requests", headers=headers_user_b, json={
        "pickup_name": "Pickup",
        "pickup_latitude": 23.05,
        "pickup_longitude": 72.5,
        "drop_name": "Drop",
        "drop_latitude": 23.18,
        "drop_longitude": 72.5,
        "desired_departure": dep_str,
        "seats_needed": 1,
    })
    assert rr_resp.status_code == 201
    rr_id = rr_resp.json()["id"]

    # Get corridor matches (may or may not find matches depending on OSRM connectivity)
    match_resp = client.get(
        f"/ride-requests/{rr_id}/corridor-matches",
        headers=headers_user_b,
        params={"buffer_m": 1000, "detour_max_km": 5.0, "time_window_minutes": 60},
    )
    assert match_resp.status_code == 200
    data = match_resp.json()
    assert "total_matches" in data
    assert "matches" in data
    assert isinstance(data["matches"], list)
