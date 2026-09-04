'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LocationAutocomplete } from '@/components/ui/LocationAutocomplete';
import { RouteMapPicker } from '@/components/ui/RouteMapPicker';
import { CorridorMatchCard } from '@/components/matching/CorridorMatchCard';
import { createRideRequestApi } from '@/lib/api/rideRequest';
import { getCorridorMatchesForRequestApi } from '@/lib/api/matching';
import { joinFuelShareApi } from '@/lib/api/joinRequest';
import { useAuth } from '@/context/AuthContext';
import { CorridorMatchResult, RideRequest } from '@/lib/api/types';

interface LocationPoint {
  name: string;
  latitude: number;
  longitude: number;
}

export default function CorridorMatchesPage() {
  const { user } = useAuth();

  // Selected Points
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [pickupInput, setPickupInput] = useState('');

  const [drop, setDrop] = useState<LocationPoint | null>(null);
  const [dropInput, setDropInput] = useState('');

  const [seatsNeeded, setSeatsNeeded] = useState(1);
  const [activeMapMode, setActiveMapMode] = useState<'origin' | 'destination'>('origin');

  // Search / Result State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchedRequest, setSearchedRequest] = useState<RideRequest | null>(null);
  const [matches, setMatches] = useState<CorridorMatchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState<Record<number, boolean>>({});

  const handleSelectPickup = (loc: LocationPoint) => {
    setPickup(loc);
    setPickupInput(loc.name);
    // Switch to destination mode if not yet set
    if (!drop) {
      setActiveMapMode('destination');
    }
  };

  const handleSelectDrop = (loc: LocationPoint) => {
    setDrop(loc);
    setDropInput(loc.name);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!user) {
      setError('Please log in to search for route matches.');
      return;
    }

    if (!pickup || !drop) {
      setError('Please select both a pickup location and a drop location.');
      return;
    }

    if (pickup.latitude === drop.latitude && pickup.longitude === drop.longitude) {
      setError('Pickup and drop locations cannot be the exact same point.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create or submit the ride request without requiring date/time
      const req = await createRideRequestApi({
        pickup_name: pickup.name,
        pickup_latitude: pickup.latitude,
        pickup_longitude: pickup.longitude,
        drop_name: drop.name,
        drop_latitude: drop.latitude,
        drop_longitude: drop.longitude,
        seats_needed: seatsNeeded,
      });
      setSearchedRequest(req);

      // Step 2: Query corridor matches for active rides
      const result = await getCorridorMatchesForRequestApi(req.id, {
        buffer_m: 1000, // 1km default buffer
      });

      setMatches(result.matches);
      setHasSearched(true);
    } catch (err: any) {
      setError(err.detail ?? err.message ?? 'Failed to find matching routes.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (targetId: number) => {
    try {
      await joinFuelShareApi(targetId);
      setJoinSuccess(prev => ({ ...prev, [targetId]: true }));
    } catch (err: any) {
      setError(err.detail ?? err.message ?? 'Failed to submit join request.');
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          🗺️ Find a Ride by Route
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your pickup and drop-off points. We'll find active riders whose route passes right through your journey.
        </p>
      </div>

      {error && <ErrorAlert message={error} onRetry={() => setError(null)} />}

      {/* Main Search & Map Picker Card */}
      <Card className="p-6 space-y-6">
        <form onSubmit={handleSearch} className="space-y-6">
          {/* Location Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pickup Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                  Pickup Location <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setActiveMapMode('origin')}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-all ${
                    activeMapMode === 'origin'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  📍 {activeMapMode === 'origin' ? 'Click Map to Place' : 'Pick on Map'}
                </button>
              </div>
              <LocationAutocomplete
                label=""
                placeholder="Search pickup area or click map..."
                value={pickupInput}
                onChange={(val) => {
                  setPickupInput(val);
                  if (pickup && pickup.name !== val) {
                    setPickup(null);
                  }
                }}
                onSelectLocation={handleSelectPickup}
                required
              />
            </div>

            {/* Drop Location */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                  Drop-off Location <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setActiveMapMode('destination')}
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold transition-all ${
                    activeMapMode === 'destination'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300 shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  🎯 {activeMapMode === 'destination' ? 'Click Map to Place' : 'Pick on Map'}
                </button>
              </div>
              <LocationAutocomplete
                label=""
                placeholder="Search drop location or click map..."
                value={dropInput}
                onChange={(val) => {
                  setDropInput(val);
                  if (drop && drop.name !== val) {
                    setDrop(null);
                  }
                }}
                onSelectLocation={handleSelectDrop}
                required
              />
            </div>
          </div>

          {/* Map Preview & Pinning */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                💡 Tip: Click anywhere on the map to set the{' '}
                <strong className={activeMapMode === 'origin' ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {activeMapMode === 'origin' ? 'Pickup Point (📍)' : 'Drop-off Point (🎯)'}
                </strong>
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Pickup
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Drop-off
                </span>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
              <RouteMapPicker
                origin={pickup}
                destination={drop}
                activeMode={activeMapMode}
                setActiveMode={setActiveMapMode}
                onSelectOrigin={handleSelectPickup}
                onSelectDestination={handleSelectDrop}
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="font-semibold">Seats needed:</span>
              <select
                value={seatsNeeded}
                onChange={(e) => setSeatsNeeded(parseInt(e.target.value, 10))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-bold focus:ring-2 focus:ring-indigo-500"
              >
                {[1, 2, 3, 4, 5, 6].map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'seat' : 'seats'}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              disabled={!pickup || !drop}
              className="w-full sm:w-auto shadow-md hover:shadow-indigo-200"
            >
              🔍 Search Rides Covering This Route
            </Button>
          </div>
        </form>
      </Card>

      {/* Results Section */}
      {loading && <LoadingSpinner message="Scanning active rider routes that pass through your points..." />}

      {!loading && hasSearched && (
        <div className="space-y-6">
          {/* Search Result Summary Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900">
                {matches.length > 0 ? (
                  <span>
                    🎉 Found <span className="text-indigo-600">{matches.length}</span> Matching{' '}
                    {matches.length === 1 ? 'Rider' : 'Riders'}
                  </span>
                ) : (
                  'No Direct Route Matches Found'
                )}
              </h2>
              {searchedRequest && (
                <p className="text-xs text-slate-500 mt-1">
                  Your desired trip: <strong className="text-slate-800">{searchedRequest.pickup_name}</strong> →{' '}
                  <strong className="text-slate-800">{searchedRequest.drop_name}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Match Results List */}
          {matches.length === 0 ? (
            <Card className="text-center py-12 space-y-3">
              <div className="text-4xl">🚗</div>
              <p className="text-base font-bold text-slate-800">
                No active rider is currently travelling along this specific path.
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                You can browse all scheduled trips on the Available Trips page or offer your own trip.
              </p>
              <div className="pt-3">
                <Link href="/fuel-shares">
                  <Button variant="outline" size="sm">
                    Browse All Fuel Shares
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 text-xs flex items-center gap-3">
                <span className="text-xl">✨</span>
                <div>
                  <strong>Your route lies directly along these drivers' journeys!</strong> You can join any of these
                  rides with minimal or zero detour for the driver.
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {matches.map((match, idx) => {
                  const joinKey = match.fuel_share_id;
                  const isJoined = joinSuccess[joinKey] || joinSuccess[match.match_id ?? -1];

                  return (
                    <div key={`${match.fuel_share_id}-${idx}`} className="flex flex-col">
                      {isJoined ? (
                        <Card className="border-emerald-200 bg-emerald-50 p-6 space-y-2">
                          <p className="text-sm font-bold text-emerald-700 flex items-center gap-2">
                            <span>✓</span> Request Sent to Driver for Ride #{match.fuel_share_id}
                          </p>
                          <p className="text-xs text-emerald-600">
                            The driver will receive your request to join at {match.pickup_name} and drop at {match.drop_name}.
                          </p>
                        </Card>
                      ) : (
                        <CorridorMatchCard
                          match={match}
                          viewMode="passenger"
                          onJoin={() => handleJoin(match.fuel_share_id)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
