from pydantic import BaseModel, Field


class Location(BaseModel):
    name: str = Field(..., min_length=1, example="Ahmedabad Junction")
    latitude: float = Field(..., ge=-90.0, le=90.0, example=23.0225)
    longitude: float = Field(..., ge=-180.0, le=180.0, example=72.5714)


class DistanceQuery(BaseModel):
    latitude_1: float = Field(..., ge=-90.0, le=90.0, example=23.0225)
    longitude_1: float = Field(..., ge=-180.0, le=180.0, example=72.5714)
    latitude_2: float = Field(..., ge=-90.0, le=90.0, example=23.2156)
    longitude_2: float = Field(..., ge=-180.0, le=180.0, example=72.6369)


class DistanceResponse(BaseModel):
    distance_km: float = Field(..., example=22.42)
    unit: str = Field("km", example="km")


class LocationSearchResult(BaseModel):
    name: str = Field(..., example="Ahmedabad Junction Railway Station")
    latitude: float = Field(..., example=23.0225)
    longitude: float = Field(..., example=72.5714)
    display_name: str = Field(..., example="Ahmedabad Junction, Railway Station Road, Ahmedabad, Gujarat, India")


class ReverseGeocodeResult(BaseModel):
    name: str = Field(..., example="Bopal, Ahmedabad, Gujarat")
    latitude: float = Field(..., example=23.0333)
    longitude: float = Field(..., example=72.4667)

