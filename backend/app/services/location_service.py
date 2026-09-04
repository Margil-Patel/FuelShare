import json
import math
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from typing import Any


class BaseGeocodingProvider(ABC):
    """Abstract interface for external geocoding and map search providers."""

    @abstractmethod
    def search_location(self, query: str) -> list[dict[str, Any]]:
        """Search for a place or address and return matches with lat/lon."""
        pass

    @abstractmethod
    def reverse_geocode(self, lat: float, lon: float) -> dict[str, Any]:
        """Reverse geocode coordinates into a human-readable location name."""
        pass


class NominatimGeocodingProvider(BaseGeocodingProvider):
    """Geocoding provider implementation using OpenStreetMap Nominatim API."""

    USER_AGENT = "FuelShareApp/1.0 (contact@fuelshare.com)"

    def search_location(self, query: str, city: str | None = None) -> list[dict[str, Any]]:
        if not query or len(query.strip()) < 2:
            return []
        
        search_query = query.strip()
        if city and city.lower() != "any" and city.lower() not in search_query.lower():
            search_query = f"{search_query}, {city}"

        encoded_query = urllib.parse.quote(search_query)
        url = f"https://nominatim.openstreetmap.org/search?format=json&q={encoded_query}&addressdetails=1&limit=8"
        req = urllib.request.Request(url, headers={"User-Agent": self.USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                results = []
                for item in data:
                    name = item.get("name") or item.get("display_name", "").split(",")[0]
                    results.append({
                        "name": name,
                        "latitude": float(item["lat"]),
                        "longitude": float(item["lon"]),
                        "display_name": item.get("display_name", name),
                    })
                return results
        except Exception:
            return []

    def reverse_geocode(self, lat: float, lon: float) -> dict[str, Any]:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
        req = urllib.request.Request(url, headers={"User-Agent": self.USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                item = json.loads(resp.read().decode("utf-8"))
                display_name = item.get("display_name", f"Location ({lat:.4f}, {lon:.4f})")
                name = item.get("name") or display_name.split(",")[0]
                return {
                    "name": name,
                    "latitude": float(lat),
                    "longitude": float(lon),
                    "display_name": display_name,
                }
        except Exception:
            return {
                "name": f"Pin ({lat:.4f}, {lon:.4f})",
                "latitude": float(lat),
                "longitude": float(lon),
                "display_name": f"Pin ({lat:.4f}, {lon:.4f})",
            }


class LocationService:
    # Earth's mean radius in kilometers
    EARTH_RADIUS_KM = 6371.0088

    @staticmethod
    def get_driving_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculates actual road driving distance in kilometers using OSRM Routing API,

        with a Haversine * 1.3 fallback if the routing service is unreachable.
        """
        if lat1 == lat2 and lon1 == lon2:
            return 0.0

        url = f"https://router.project-osrm.org/route/v1/driving/{lon2},{lat1};{lon2},{lat2}?overview=false"
        url = f"https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
        req = urllib.request.Request(url, headers={"User-Agent": "FuelShareApp/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=4) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("code") == "Ok" and data.get("routes"):
                    distance_meters = data["routes"][0]["distance"]
                    return round(distance_meters / 1000.0, 2)
        except Exception:
            pass

        # Fallback to Haversine * 1.3 (estimated road distance multiplier)
        straight_dist = LocationService.haversine_distance(lat1, lon1, lat2, lon2)
        return round(straight_dist * 1.3, 2)

    @staticmethod
    def get_route_with_polyline(
        lat1: float, lon1: float, lat2: float, lon2: float
    ) -> dict[str, Any]:
        """Fetches the driving route from OSRM, returning distance_km and encoded polyline.

        The polyline uses Google's precision-5 encoding (same as OSRM's polyline format).
        Falls back to a straight-line polyline + haversine*1.3 distance if OSRM is unreachable.

        Returns a dict with keys:
            - ``distance_km`` (float)
            - ``polyline`` (str) — encoded polyline of the route
        """
        if lat1 == lat2 and lon1 == lon2:
            return {"distance_km": 0.0, "polyline": ""}

        url = (
            f"https://router.project-osrm.org/route/v1/driving/"
            f"{lon1},{lat1};{lon2},{lat2}"
            f"?overview=full&geometries=polyline"
        )
        req = urllib.request.Request(url, headers={"User-Agent": "FuelShareApp/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("code") == "Ok" and data.get("routes"):
                    route = data["routes"][0]
                    distance_km = round(route["distance"] / 1000.0, 2)
                    polyline_str = route.get("geometry", "")
                    return {"distance_km": distance_km, "polyline": polyline_str}
        except Exception:
            pass

        # Fallback: straight-line polyline (A -> B) + haversine*1.3 distance
        from app.services.polyline_utils import encode_polyline
        fallback_dist = round(LocationService.haversine_distance(lat1, lon1, lat2, lon2) * 1.3, 2)
        fallback_polyline = encode_polyline([(lat1, lon1), (lat2, lon2)])
        return {"distance_km": fallback_dist, "polyline": fallback_polyline}

    @staticmethod
    def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculates the approximate straight-line (great-circle) geographic distance between

        two (latitude, longitude) coordinate pairs in kilometers using the Haversine formula.
        """
        # Return 0.0 for identical coordinates
        if lat1 == lat2 and lon1 == lon2:
            return 0.0

        # Convert degrees to radians
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        # Haversine formula
        a = (
            math.sin(delta_phi / 2.0) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        )
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

        distance = LocationService.EARTH_RADIUS_KM * c
        return round(distance, 2)
