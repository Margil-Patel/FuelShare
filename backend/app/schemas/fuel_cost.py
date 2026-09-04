from pydantic import BaseModel, ConfigDict


class FuelCostResponse(BaseModel):
    fuel_share_id: int
    distance_km: float
    fuel_price_per_litre: float
    vehicle_mileage_km_per_litre: float
    fuel_required_litres: float
    total_fuel_cost: float
    participant_count: int
    cost_per_participant: float
    estimated_savings_per_participant: float
    estimated_fuel_saved_litres: float

    model_config = ConfigDict(from_attributes=True)
