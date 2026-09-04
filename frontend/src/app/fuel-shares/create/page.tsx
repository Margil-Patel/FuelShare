'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { RouteMapPicker } from '@/components/ui/RouteMapPicker';
import { createFuelShareApi } from '@/lib/api/fuelShare';
import { getVehiclesApi } from '@/lib/api/vehicle';
import { searchLocationsApi, reverseGeocodeApi, fetchDrivingRouteApi } from '@/lib/api/location';

export default function CreateFuelSharePage() {
  const router = useRouter();

  // Location state (empty by default for user entry)
  const [sourceName, setSourceName] = useState('');
  const [sourceLat, setSourceLat] = useState(23.0225);
  const [sourceLng, setSourceLng] = useState(72.5714);

  const [destName, setDestName] = useState('');
  const [destLat, setDestLat] = useState(23.2156);
  const [destLng, setDestLng] = useState(72.6369);

  // Active map pick mode
  const [activeMapMode, setActiveMapMode] = useState<'origin' | 'destination'>('origin');

  // Optional city filter scope (default: Any City for unrestricted search)
  const [selectedCity, setSelectedCity] = useState('Any City');

  const CITIES = ['Any City', 'Ahmedabad', 'Bengaluru', 'Mumbai', 'Delhi NCR', 'Pune', 'Hyderabad', 'Surat', 'Anand'];

  // Vehicle & Seat state
  const [availableSeats, setAvailableSeats] = useState(3);
  const [vehicleMileage, setVehicleMileage] = useState<number>(15.0);
  const [vehicleName, setVehicleName] = useState<string>('Standard Vehicle');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch creator's vehicle mileage on load
  useEffect(() => {
    async function loadUserVehicle() {
      try {
        const vehicles = await getVehiclesApi();
        if (vehicles && vehicles.length > 0) {
          const v = vehicles[0];
          if (v.mileage > 0) {
            setVehicleMileage(v.mileage);
            setVehicleName(`${v.vehicle_type} (${v.fuel_type}, ${v.mileage} km/L)`);
          }
        }
      } catch {
        // Fallback to 15 km/L default
      }
    }
    loadUserVehicle();
  }, []);

  const [drivingDistance, setDrivingDistance] = useState<number>(0);

  // Haversine distance fallback (in km)
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (lat1 === lat2 && lon1 === lon2) return 0;
    const R = 6371.0088; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  };

  // Fetch actual driving road distance via OSRM
  useEffect(() => {
    let isCancelled = false;
    async function loadDrivingDistance() {
      if (sourceLat && sourceLng && destLat && destLng && (sourceLat !== destLat || sourceLng !== destLng)) {
        const routeData = await fetchDrivingRouteApi(sourceLat, sourceLng, destLat, destLng);
        if (!isCancelled && routeData && routeData.distance_km > 0) {
          setDrivingDistance(routeData.distance_km);
          return;
        }
      }
      const haversine = calculateHaversineDistance(sourceLat, sourceLng, destLat, destLng);
      if (!isCancelled) {
        setDrivingDistance(Math.round(haversine * 1.3 * 100) / 100);
      }
    }
    loadDrivingDistance();
    return () => {
      isCancelled = true;
    };
  }, [sourceLat, sourceLng, destLat, destLng]);

  const estimatedDistance = drivingDistance;
  const DEFAULT_FUEL_PRICE = 100.0; // ₹100 per Litre
  const fuelRequiredLitres = estimatedDistance > 0 ? estimatedDistance / vehicleMileage : 0;
  const calculatedFuelCost = Math.round(fuelRequiredLitres * DEFAULT_FUEL_PRICE * 100) / 100;

  const validateForm = (): boolean => {
    if (!sourceName.trim()) {
      setError('Please select or search a valid pickup location.');
      return false;
    }
    if (!destName.trim()) {
      setError('Please select or search a valid destination location.');
      return false;
    }
    if (Number(availableSeats) <= 0) {
      setError('Available seats must be at least 1.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) return;

    // Set dynamic future departure window (current local time + 2 hours)
    const departureWindow = new Date();
    departureWindow.setHours(departureWindow.getHours() + 2);

    const year = departureWindow.getFullYear();
    const month = String(departureWindow.getMonth() + 1).padStart(2, '0');
    const day = String(departureWindow.getDate()).padStart(2, '0');
    const departureDateStr = `${year}-${month}-${day}`;

    const hours = String(departureWindow.getHours()).padStart(2, '0');
    const minutes = String(departureWindow.getMinutes()).padStart(2, '0');
    const departureTimeStr = `${hours}:${minutes}:00`;

    setLoading(true);
    try {
      const created = await createFuelShareApi({
        source_name: sourceName.trim(),
        source_latitude: sourceLat,
        source_longitude: sourceLng,
        destination_name: destName.trim(),
        destination_latitude: destLat,
        destination_longitude: destLng,
        departure_date: departureDateStr,
        departure_time: departureTimeStr,
        available_seats: Number(availableSeats),
        estimated_distance: estimatedDistance > 0 ? estimatedDistance : undefined,
        estimated_fuel_cost: calculatedFuelCost > 0 ? calculatedFuelCost : undefined,
      });
      router.push(`/fuel-shares/${created.id}`);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to create Fuel Share offer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create Fuel Share Offer</h1>
            <p className="text-sm text-slate-500 mt-1">
              Select points on the map or type to search location suggestions.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            ← Back
          </Button>
        </div>

        <Card subtitle="Post your upcoming commute to find matching passengers and split fuel expenses">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <ErrorAlert message={error} />}

            {/* Route & Interactive Map Section */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/70 border border-indigo-100 p-3 rounded-2xl">
                <div>
                  <span className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider block">
                    🗺️ Open Location Autocomplete Search
                  </span>
                  <span className="text-xs text-indigo-700">
                    Type any starting point & ending point, or pick directly on the interactive map.
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-slate-500 mr-1">City Filter:</span>
                  {CITIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedCity(c)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                        selectedCity === c
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-indigo-100'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LocationAutocomplete
                  label="Starting Point"
                  placeholder="Enter Starting Point (e.g. Bopal, Station, Koramangala)"
                  value={sourceName}
                  onChange={(val) => setSourceName(val)}
                  onSelectLocation={(loc) => {
                    setSourceName(loc.name);
                    setSourceLat(loc.latitude);
                    setSourceLng(loc.longitude);
                  }}
                  city={selectedCity === 'Any City' ? undefined : selectedCity}
                  helperText={sourceName ? `Selected Coordinates: ${sourceLat.toFixed(4)}, ${sourceLng.toFixed(4)}` : undefined}
                  required
                />

                <LocationAutocomplete
                  label="Ending Point"
                  placeholder="Enter Ending Point (e.g. SG Highway, Airport, Tech Park)"
                  value={destName}
                  onChange={(val) => setDestName(val)}
                  onSelectLocation={(loc) => {
                    setDestName(loc.name);
                    setDestLat(loc.latitude);
                    setDestLng(loc.longitude);
                  }}
                  city={selectedCity === 'Any City' ? undefined : selectedCity}
                  helperText={destName ? `Selected Coordinates: ${destLat.toFixed(4)}, ${destLng.toFixed(4)}` : undefined}
                  required
                />
              </div>

              {/* Interactive Map Picker */}
              <div className="pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Interactive Route Map (Click Map to Drop Pins)
                </label>
                <RouteMapPicker
                  origin={{ name: sourceName, latitude: sourceLat, longitude: sourceLng }}
                  destination={{ name: destName, latitude: destLat, longitude: destLng }}
                  activeMode={activeMapMode}
                  setActiveMode={setActiveMapMode}
                  onSelectOrigin={(loc) => {
                    setSourceName(loc.name);
                    setSourceLat(loc.latitude);
                    setSourceLng(loc.longitude);
                  }}
                  onSelectDestination={(loc) => {
                    setDestName(loc.name);
                    setDestLat(loc.latitude);
                    setDestLng(loc.longitude);
                  }}
                />
              </div>
            </div>

            {/* Seat Availability */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                2. Seat Availability
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Available Seats"
                  type="number"
                  min={1}
                  max={12}
                  value={availableSeats}
                  onChange={(e) => setAvailableSeats(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            {/* Automated Fuel Cost Calculation */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                3. Automated Fuel Cost Algorithm (Calculated via Distance)
              </h3>

              <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                      ⚡ Algorithm Estimated Fuel Cost
                    </span>
                    <span className="text-3xl font-extrabold text-white tracking-tight">
                      ₹{calculatedFuelCost.toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-slate-800/80 px-4 py-2.5 rounded-xl border border-slate-700 text-right">
                    <span className="text-xs text-slate-400 block">Trip Distance</span>
                    <span className="text-lg font-bold text-cyan-300">
                      {estimatedDistance > 0 ? `${estimatedDistance} km` : 'Select Locations'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                  <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block font-semibold mb-0.5">🚗 Vehicle</span>
                    <span className="font-bold text-white truncate block">{vehicleName}</span>
                  </div>

                  <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block font-semibold mb-0.5">⛽ Required Fuel</span>
                    <span className="font-bold text-emerald-300">
                      {fuelRequiredLitres.toFixed(2)} Litres
                    </span>
                  </div>

                  <div className="bg-slate-800/50 p-2.5 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block font-semibold mb-0.5">💸 Base Fuel Price</span>
                    <span className="font-bold text-cyan-300">₹{DEFAULT_FUEL_PRICE}/Litre</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-800/80 pt-3">
                  💡 <b>Formula:</b> Total Fuel Cost = (Distance in km ÷ Mileage in km/L) × Fuel Price per Litre. This transparent cost is automatically split equally among all accepted trip participants.
                </p>
              </div>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-100 justify-end">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" isLoading={loading}>
                Create Fuel Share Offer
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </ProtectedRoute>
  );
}
