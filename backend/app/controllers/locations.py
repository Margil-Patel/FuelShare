from fastapi import APIRouter, Query, status

from app.schemas.location import DistanceResponse, LocationSearchResult, ReverseGeocodeResult
from app.services.location_service import LocationService, NominatimGeocodingProvider

router = APIRouter(prefix="/locations", tags=["Location & Geospatial"])
geocoding_provider = NominatimGeocodingProvider()


@router.get(
    "/search",
    response_model=list[LocationSearchResult],
    status_code=status.HTTP_200_OK,
    summary="Search Location Autocomplete Suggestions",
)
def search_locations(
    q: str = Query(..., min_length=2, description="Place or area search query"),
    city: str | None = Query(None, description="Focus city for intra-city search (e.g. Ahmedabad, Bengaluru)"),
):
    """Returns address and coordinate autocomplete suggestions focused on intra-city locations."""
    results = geocoding_provider.search_location(q, city=city)
    return [LocationSearchResult(**item) for item in results]


@router.get(
    "/reverse",
    response_model=ReverseGeocodeResult,
    status_code=status.HTTP_200_OK,
    summary="Reverse Geocode Coordinates to Address",
)
def reverse_geocode(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
):
    """Converts latitude and longitude into a human-readable location name."""
    result = geocoding_provider.reverse_geocode(lat, lon)
    return ReverseGeocodeResult(**result)


@router.get(
    "/distance",
    response_model=DistanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate Geographic Distance Between Coordinates",
)
def calculate_distance(
    latitude_1: float = Query(..., ge=-90.0, le=90.0, description="Source latitude (-90 to 90)"),
    longitude_1: float = Query(..., ge=-180.0, le=180.0, description="Source longitude (-180 to 180)"),
    latitude_2: float = Query(..., ge=-90.0, le=90.0, description="Destination latitude (-90 to 90)"),
    longitude_2: float = Query(..., ge=-180.0, le=180.0, description="Destination longitude (-180 to 180)"),
):
    """Calculates the straight-line geographic distance in kilometers between two latitude/longitude
    coordinate pairs using the Haversine formula.
    """
    distance = LocationService.haversine_distance(
        latitude_1, longitude_1, latitude_2, longitude_2
    )
    return DistanceResponse(distance_km=distance, unit="km")

