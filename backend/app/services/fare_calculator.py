"""
Pluggable fare calculation strategies for corridor-based ride matching.

Two strategies are provided:
  - ``EvenSplitStrategy``          — total_cost / number_of_passengers (existing behavior)
  - ``DistanceProportionalStrategy``— passenger_km / total_km * total_cost

Usage:
    strategy = get_fare_strategy(settings.FARE_SPLIT_STRATEGY)
    fare = strategy.calculate(passenger_distance_km, total_distance_km, total_fuel_cost, n_passengers)
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class FareStrategy(ABC):
    """Abstract fare calculation strategy."""

    @abstractmethod
    def calculate(
        self,
        passenger_distance_km: float,
        total_distance_km: float,
        total_fuel_cost: float,
        n_passengers: int,
    ) -> float:
        """Return the fare (₹) for one passenger.

        Args:
            passenger_distance_km: distance (km) the passenger travels (C→D distance).
            total_distance_km:     total route length (km) A→B.
            total_fuel_cost:       total estimated fuel cost (₹) for A→B.
            n_passengers:          number of passengers sharing this ride segment.
        """
        ...

    @property
    @abstractmethod
    def name(self) -> str:
        """Short identifier returned in API responses."""
        ...


class DistanceProportionalStrategy(FareStrategy):
    """
    Fare = (passenger_km / total_km) * total_cost.

    Fairer for partial-route passengers (e.g. a passenger going 10 km on a
    40 km route pays 25% of the total cost).
    """

    @property
    def name(self) -> str:
        return "proportional"

    def calculate(
        self,
        passenger_distance_km: float,
        total_distance_km: float,
        total_fuel_cost: float,
        n_passengers: int,
    ) -> float:
        if total_distance_km <= 0 or total_fuel_cost <= 0:
            return 0.0
        fraction = min(passenger_distance_km / total_distance_km, 1.0)
        return round(fraction * total_fuel_cost, 2)


class EvenSplitStrategy(FareStrategy):
    """
    Fare = total_cost / n_passengers.

    Existing FuelShare behavior: all participants share cost equally
    regardless of how far they travel.
    """

    @property
    def name(self) -> str:
        return "even"

    def calculate(
        self,
        passenger_distance_km: float,
        total_distance_km: float,
        total_fuel_cost: float,
        n_passengers: int,
    ) -> float:
        if n_passengers <= 0 or total_fuel_cost <= 0:
            return 0.0
        return round(total_fuel_cost / n_passengers, 2)


_STRATEGIES: dict[str, FareStrategy] = {
    "proportional": DistanceProportionalStrategy(),
    "even": EvenSplitStrategy(),
}


def get_fare_strategy(name: str) -> FareStrategy:
    """Return the fare strategy matching *name* (case-insensitive).

    Falls back to ``DistanceProportionalStrategy`` if the name is unknown.
    """
    return _STRATEGIES.get(name.lower(), _STRATEGIES["proportional"])
