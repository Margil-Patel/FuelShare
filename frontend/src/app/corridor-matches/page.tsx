'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { CorridorMatchCard } from '@/components/matching/CorridorMatchCard';
import { RouteMap } from '@/components/matching/RouteMap';
import { createRideRequestApi } from '@/lib/api/rideRequest';
import { getCorridorMatchesForRequestApi } from '@/lib/api/matching';
import { joinFuelShareApi } from '@/lib/api/joinRequest';
import { useAuth } from '@/context/AuthContext';
import { CorridorMatchResult, RideRequest } from '@/lib/api/types';

type Step = 'form' | 'results';

export default function CorridorMatchesPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('form');

  // Form fields
  const [pickupName, setPickupName] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLon, setPickupLon] = useState('');
  const [dropName, setDropName] = useState('');
  const [dropLat, setDropLat] = useState('');
  const [dropLon, setDropLon] = useState('');
  const [desiredTime, setDesiredTime] = useState('');
  const [seatsNeeded, setSeatsNeeded] = useState('1');
  const [bufferM, setBufferM] = useState('500');
  const [timeWindow, setTimeWindow] = useState('30');

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [matches, setMatches] = useState<CorridorMatchResult[]>([]);
  const [joinSuccess, setJoinSuccess] = useState<Record<number, boolean>>({});

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError('Please log in to search for corridor matches.'); return; }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Create the ride request
      const req = await createRideRequestApi({
        pickup_name: pickupName,
        pickup_latitude: parseFloat(pickupLat),
        pickup_longitude: parseFloat(pickupLon),
        drop_name: dropName,
        drop_latitude: parseFloat(dropLat),
        drop_longitude: parseFloat(dropLon),
        desired_departure: desiredTime,
        seats_needed: parseInt(seatsNeeded, 10) || 1,
      });
      setRideRequest(req);

      // Step 2: Find corridor matches
      const result = await getCorridorMatchesForRequestApi(req.id, {
        buffer_m: parseInt(bufferM, 10),
        time_window_minutes: parseInt(timeWindow, 10),
      });

      setMatches(result.matches);
      setStep('results');
    } catch (err: any) {
      setError(err.detail ?? err.message ?? 'Failed to search for corridor matches.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (matchId: number) => {
    // Find the match and join the corresponding fuel share
    const match = matches.find(m => m.match_id === matchId);
    if (!match) return;
    try {
      await joinFuelShareApi(match.fuel_share_id);
      setJoinSuccess(prev => ({ ...prev, [matchId]: true }));
    } catch (err: any) {
      setError(err.detail ?? err.message ?? 'Failed to submit join request.');
    }
  };

  const resetForm = () => {
    setStep('form');
    setMatches([]);
    setRideRequest(null);
    setError(null);
  };

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          🗺️ Find a Ride by Route
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Enter your pickup and drop points — we'll find rides whose route passes through your corridor.
        </p>
      </div>

      {error && <ErrorAlert message={error} onRetry={() => setError(null)} />}

      {step === 'form' && (
        <form onSubmit={handleSearch} className="space-y-6">
          {/* Pickup section */}
          <Card>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
              📍 Your Pickup Point (C)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Pickup Location Name"
                placeholder="e.g. Bopal Cross Roads"
                value={pickupName}
                onChange={e => setPickupName(e.target.value)}
                required
              />
              <Input
                label="Latitude"
                type="number"
                step="any"
                placeholder="23.0225"
                value={pickupLat}
                onChange={e => setPickupLat(e.target.value)}
                required
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                placeholder="72.4716"
                value={pickupLon}
                onChange={e => setPickupLon(e.target.value)}
                required
              />
            </div>
          </Card>

          {/* Drop section */}
          <Card>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
              🏁 Your Drop Point (D)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Drop Location Name"
                placeholder="e.g. SG Highway"
                value={dropName}
                onChange={e => setDropName(e.target.value)}
                required
              />
              <Input
                label="Latitude"
                type="number"
                step="any"
                placeholder="23.0390"
                value={dropLat}
                onChange={e => setDropLat(e.target.value)}
                required
              />
              <Input
                label="Longitude"
                type="number"
                step="any"
                placeholder="72.5062"
                value={dropLon}
                onChange={e => setDropLon(e.target.value)}
                required
              />
            </div>
          </Card>

          {/* Time + Advanced */}
          <Card>
            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
              ⚙️ Trip Preferences
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Desired Departure"
                  type="datetime-local"
                  value={desiredTime}
                  onChange={e => setDesiredTime(e.target.value)}
                  required
                />
              </div>
              <Input
                label="Seats Needed"
                type="number"
                min="1"
                max="8"
                value={seatsNeeded}
                onChange={e => setSeatsNeeded(e.target.value)}
              />
              <Input
                label="Buffer (meters)"
                type="number"
                min="50"
                max="5000"
                value={bufferM}
                onChange={e => setBufferM(e.target.value)}
              />
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Input
                label="Time Window (±mins)"
                type="number"
                min="5"
                max="120"
                value={timeWindow}
                onChange={e => setTimeWindow(e.target.value)}
              />
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="lg" isLoading={loading}>
              🔍 Search Corridor Matches
            </Button>
          </div>
        </form>
      )}

      {step === 'results' && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-slate-700">
                Found <span className="text-indigo-600">{matches.length}</span> ride{matches.length !== 1 ? 's' : ''} matching your corridor
              </p>
              {rideRequest && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {rideRequest.pickup_name} → {rideRequest.drop_name} · Request #{rideRequest.id}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={resetForm}>
              ← New Search
            </Button>
          </div>

          {/* Corridor overview map (passenger's points, no route) */}
          {rideRequest && (
            <Card>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Your Corridor</h3>
              <RouteMap
                pickup={{ lat: rideRequest.pickup_latitude, lng: rideRequest.pickup_longitude, label: rideRequest.pickup_name }}
                drop={{ lat: rideRequest.drop_latitude, lng: rideRequest.drop_longitude, label: rideRequest.drop_name }}
                height="200px"
              />
              <p className="text-xs text-slate-400 mt-2 text-center">
                🟠 Orange = Your pickup (C) &nbsp;·&nbsp; 🟣 Purple = Your drop (D)
              </p>
            </Card>
          )}

          {/* Match cards */}
          {loading ? (
            <LoadingSpinner message="Searching route corridors..." />
          ) : matches.length === 0 ? (
            <Card className="text-center py-12">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-base font-bold text-slate-700">No corridor matches found.</p>
              <p className="text-xs text-slate-500 mt-1">
                Try increasing the buffer distance or time window, or check back later when more rides are available.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={resetForm}>
                Adjust Search
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {matches.map((match, idx) => (
                <div key={`${match.fuel_share_id}-${idx}`}>
                  {joinSuccess[match.match_id ?? -1] ? (
                    <Card className="border-emerald-200 bg-emerald-50">
                      <p className="text-sm font-bold text-emerald-700">
                        ✓ Join request sent for Ride #{match.fuel_share_id}
                      </p>
                      <p className="text-xs text-emerald-600 mt-1">
                        The driver will review and accept your request.
                      </p>
                    </Card>
                  ) : (
                    <CorridorMatchCard
                      match={match}
                      viewMode="passenger"
                      onJoin={handleJoin}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
