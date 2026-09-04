'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { RouteMap } from '@/components/matching/RouteMap';
import { CorridorMatchCard } from '@/components/matching/CorridorMatchCard';
import { getRiderCorridorMatchesApi } from '@/lib/api/matching';
import { getFuelShareByIdApi } from '@/lib/api/fuelShare';
import { useAuth } from '@/context/AuthContext';
import { FuelShare, CorridorMatchResult } from '@/lib/api/types';

export default function RiderCorridorPage({
  params,
}: {
  params?: Promise<{ id: string }>;
}) {
  const routeParams = useParams<{ id: string }>();
  const resolvedParams = params ? React.use(params) : routeParams;
  const router = useRouter();
  const { user } = useAuth();
  const fuelShareId = Number(resolvedParams?.id);

  const [fuelShare, setFuelShare] = useState<FuelShare | null>(null);
  const [matches, setMatches] = useState<CorridorMatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [bufferM, setBufferM] = useState(1000);
  const [timeWindow, setTimeWindow] = useState<number | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMatches = async (buf?: number, tw?: number) => {
    try {
      setRefreshing(true);
      const data = await getRiderCorridorMatchesApi(fuelShareId, {
        buffer_m: buf ?? bufferM,
        time_window_minutes: tw !== undefined ? tw : timeWindow,
      });
      setMatches(data.matches);
    } catch (err: any) {
      setError(err.detail ?? err.message ?? 'Failed to load corridor matches.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const fs = await getFuelShareByIdApi(fuelShareId);
        setFuelShare(fs);
        await fetchMatches();
      } catch (err: any) {
        setError(err.detail ?? err.message ?? 'Failed to load ride details.');
      } finally {
        setLoading(false);
      }
    };
    if (fuelShareId) init();
  }, [fuelShareId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => fetchMatches();

  if (loading) return <LoadingSpinner message="Loading corridor matches..." />;
  if (error) return <ErrorAlert message={error} />;
  if (!fuelShare) return null;

  // Build passenger markers for map
  const passengerMarkers = matches.map(m => ({
    pickup: { lat: m.pickup_latitude, lng: m.pickup_longitude, label: m.pickup_name },
    drop: { lat: m.drop_latitude, lng: m.drop_longitude, label: m.drop_name },
    label: `₹${m.fare_estimate.toFixed(0)}`,
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => router.push(`/fuel-shares/${fuelShareId}`)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold mb-2 flex items-center gap-1"
          >
            ← Back to Ride Details
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            🛣️ Corridor Passengers
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {fuelShare.source_name} → {fuelShare.destination_name}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-slate-600 font-medium">Buffer</label>
            <select
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
              value={bufferM}
              onChange={e => { setBufferM(Number(e.target.value)); fetchMatches(Number(e.target.value), timeWindow); }}
            >
              {[250, 500, 750, 1000, 2000].map(v => (
                <option key={v} value={v}>{v}m</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <label className="text-slate-600 font-medium">Window</label>
            <select
              className="border border-slate-200 rounded-lg px-2 py-1 text-sm"
              value={timeWindow}
              onChange={e => { setTimeWindow(Number(e.target.value)); fetchMatches(bufferM, Number(e.target.value)); }}
            >
              {[15, 30, 60, 120].map(v => (
                <option key={v} value={v}>±{v}min</option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="sm" isLoading={refreshing} onClick={handleRefresh}>
            ↺ Refresh
          </Button>
        </div>
      </div>

      {/* Route map with all passengers overlaid */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
            Your Route + Matching Passengers
          </h2>
          <div className="flex gap-3 text-xs text-slate-500">
            <span><span className="font-bold text-green-600">●</span> Origin A</span>
            <span><span className="font-bold text-red-500">●</span> Destination B</span>
            <span><span className="font-bold text-orange-500">◆</span> Passenger Pickups</span>
            <span><span className="font-bold text-purple-600">◆</span> Passenger Drops</span>
          </div>
        </div>
        <RouteMap
          routePolyline={fuelShare.route_polyline}
          origin={{ lat: fuelShare.source_latitude, lng: fuelShare.source_longitude, label: fuelShare.source_name }}
          destination={{ lat: fuelShare.destination_latitude, lng: fuelShare.destination_longitude, label: fuelShare.destination_name }}
          passengerMarkers={passengerMarkers}
          bufferM={bufferM}
          height="380px"
        />
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center py-4">
          <div className="text-2xl font-black text-indigo-700">{matches.length}</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Matching Passengers</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-black text-emerald-600">{fuelShare.available_seats}</div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Seats Available</div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-2xl font-black text-violet-600">
            ₹{matches.length > 0 ? (matches.reduce((s, m) => s + m.fare_estimate, 0) / matches.length).toFixed(0) : '—'}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">Avg Fare Estimate</div>
        </Card>
      </div>

      {/* Passenger match cards */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-4">
          Passenger Requests in Corridor
          {refreshing && <span className="ml-2 text-xs text-slate-400 font-normal">refreshing…</span>}
        </h2>

        {matches.length === 0 ? (
          <Card className="text-center py-12">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-base font-bold text-slate-700">No passengers in corridor yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              Passengers with pickup/drop points within {bufferM}m of your route will appear here.
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Try widening the buffer distance or time window above.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {matches.map((match, idx) => (
              <CorridorMatchCard
                key={`${match.ride_request_id}-${idx}`}
                match={match}
                viewMode="rider"
                onAccepted={() => fetchMatches()}
                onRejected={() => fetchMatches()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
