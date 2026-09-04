"""
Polyline utilities for corridor-based route matching.

Provides:
- Google/OSRM encoded polyline decode / encode
- Point-to-segment perpendicular distance (meters)
- Point location on polyline (0–1 fraction)
- Point-to-polyline minimum distance
"""
import math
from typing import Sequence

# Earth's mean radius in km
_EARTH_RADIUS_KM = 6371.0088
_EARTH_RADIUS_M = _EARTH_RADIUS_KM * 1000.0


# ---------------------------------------------------------------------------
# Encoded polyline codec (Google / OSRM precision-5 format)
# ---------------------------------------------------------------------------

def decode_polyline(encoded: str) -> list[tuple[float, float]]:
    """Decode an encoded polyline string into a list of (lat, lng) tuples."""
    coords: list[tuple[float, float]] = []
    index = 0
    lat = 0
    lng = 0
    length = len(encoded)

    while index < length:
        # Decode latitude
        result = 0
        shift = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        delta_lat = ~(result >> 1) if (result & 1) else (result >> 1)
        lat += delta_lat

        # Decode longitude
        result = 0
        shift = 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        delta_lng = ~(result >> 1) if (result & 1) else (result >> 1)
        lng += delta_lng

        coords.append((lat / 1e5, lng / 1e5))

    return coords


def encode_polyline(coords: Sequence[tuple[float, float]]) -> str:
    """Encode a sequence of (lat, lng) tuples into a Google/OSRM encoded polyline string."""
    output: list[str] = []
    prev_lat = 0
    prev_lng = 0

    def _encode_value(value: int) -> str:
        value = ~(value << 1) if value < 0 else (value << 1)
        chunks = []
        while value >= 0x20:
            chunks.append(chr((0x20 | (value & 0x1F)) + 63))
            value >>= 5
        chunks.append(chr(value + 63))
        return "".join(chunks)

    for lat, lng in coords:
        lat_e5 = round(lat * 1e5)
        lng_e5 = round(lng * 1e5)
        output.append(_encode_value(lat_e5 - prev_lat))
        output.append(_encode_value(lng_e5 - prev_lng))
        prev_lat = lat_e5
        prev_lng = lng_e5

    return "".join(output)


# ---------------------------------------------------------------------------
# Spatial geometry helpers (using flat-earth approximation for small distances)
# ---------------------------------------------------------------------------

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lng points in meters."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2.0 * _EARTH_RADIUS_M * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _to_xyz(lat: float, lon: float) -> tuple[float, float, float]:
    """Convert lat/lon (degrees) to ECEF unit-sphere xyz."""
    phi = math.radians(lat)
    lam = math.radians(lon)
    x = math.cos(phi) * math.cos(lam)
    y = math.cos(phi) * math.sin(lam)
    z = math.sin(phi)
    return x, y, z


def point_to_segment_distance_m(
    pt: tuple[float, float],
    seg_a: tuple[float, float],
    seg_b: tuple[float, float],
) -> float:
    """
    Minimum distance in meters from point *pt* (lat, lon) to the line segment
    seg_a→seg_b (lat, lon).  Uses a flat-earth Cartesian approximation that is
    accurate to within ~0.3% for segments up to ~50 km.
    """
    lat0, lon0 = pt
    lat1, lon1 = seg_a
    lat2, lon2 = seg_b

    # Project to a local flat-Earth frame centred on seg_a
    cos_lat = math.cos(math.radians(lat1))
    R = _EARTH_RADIUS_M

    ax, ay = 0.0, 0.0
    bx = (lon2 - lon1) * cos_lat * R * math.pi / 180.0
    by = (lat2 - lat1) * R * math.pi / 180.0
    px = (lon0 - lon1) * cos_lat * R * math.pi / 180.0
    py = (lat0 - lat1) * R * math.pi / 180.0

    seg_len_sq = bx ** 2 + by ** 2
    if seg_len_sq < 1e-10:  # degenerate segment (A == B)
        return math.sqrt(px ** 2 + py ** 2)

    # Parameter t of projection of P onto segment AB
    t = max(0.0, min(1.0, (px * bx + py * by) / seg_len_sq))
    closest_x = ax + t * bx
    closest_y = ay + t * by
    dx = px - closest_x
    dy = py - closest_y
    return math.sqrt(dx ** 2 + dy ** 2)


def point_to_segment_fraction(
    pt: tuple[float, float],
    seg_a: tuple[float, float],
    seg_b: tuple[float, float],
) -> float:
    """
    Returns the fraction t ∈ [0, 1] of the closest point on segment seg_a→seg_b
    to the point *pt*, measured from seg_a.
    """
    lat1, lon1 = seg_a
    lat2, lon2 = seg_b

    cos_lat = math.cos(math.radians(lat1))
    R = _EARTH_RADIUS_M

    bx = (lon2 - lon1) * cos_lat * R * math.pi / 180.0
    by = (lat2 - lat1) * R * math.pi / 180.0
    px = (pt[1] - lon1) * cos_lat * R * math.pi / 180.0
    py = (pt[0] - lat1) * R * math.pi / 180.0

    seg_len_sq = bx ** 2 + by ** 2
    if seg_len_sq < 1e-10:
        return 0.0
    return max(0.0, min(1.0, (px * bx + py * by) / seg_len_sq))


def locate_point_on_polyline(
    point: tuple[float, float],
    polyline: list[tuple[float, float]],
) -> float:
    """
    Returns the linear location of *point* along *polyline* as a fraction in [0, 1].

    The fraction is computed as:
        (cumulative length up to closest segment + t * segment length) / total length

    Args:
        point:    (lat, lon) of the query point.
        polyline: ordered list of (lat, lon) waypoints.

    Returns:
        float in [0, 1] representing how far along the polyline the point projects.
    """
    if len(polyline) < 2:
        return 0.0

    # Pre-compute cumulative arc lengths
    seg_lengths: list[float] = []
    for i in range(len(polyline) - 1):
        seg_lengths.append(_haversine_m(polyline[i][0], polyline[i][1],
                                         polyline[i + 1][0], polyline[i + 1][1]))
    total_length = sum(seg_lengths)
    if total_length < 1e-6:
        return 0.0

    best_dist = math.inf
    best_along = 0.0
    cumulative = 0.0

    for i in range(len(polyline) - 1):
        seg_a = polyline[i]
        seg_b = polyline[i + 1]
        d = point_to_segment_distance_m(point, seg_a, seg_b)
        if d < best_dist:
            best_dist = d
            t = point_to_segment_fraction(point, seg_a, seg_b)
            best_along = cumulative + t * seg_lengths[i]
        cumulative += seg_lengths[i]

    return best_along / total_length


def min_distance_to_polyline_m(
    point: tuple[float, float],
    polyline: list[tuple[float, float]],
) -> float:
    """
    Returns the minimum perpendicular distance in meters from *point* to *polyline*.
    """
    if not polyline:
        return math.inf
    if len(polyline) == 1:
        return _haversine_m(point[0], point[1], polyline[0][0], polyline[0][1])

    min_dist = math.inf
    for i in range(len(polyline) - 1):
        d = point_to_segment_distance_m(point, polyline[i], polyline[i + 1])
        if d < min_dist:
            min_dist = d
    return min_dist
