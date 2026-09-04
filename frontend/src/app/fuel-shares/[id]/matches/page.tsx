'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { MatchCard } from '@/components/matching/MatchCard';
import { getFuelShareByIdApi } from '@/lib/api/fuelShare';
import { getMatchesApi } from '@/lib/api/matching';
import { FuelShare, MatchListResponse } from '@/lib/api/types';
import { useAuth } from '@/context/AuthContext';

export default function FindMatchesPage({
  params,
}: {
  params?: Promise<{ id: string }>;
}) {
  const routeParams = useParams<{ id: string }>();
  const resolvedParams = params ? React.use(params) : routeParams;
  const router = useRouter();
  const id = Number(resolvedParams?.id);
  const { user } = useAuth();

  const [trip, setTrip] = useState<FuelShare | null>(null);
  const [matchData, setMatchData] = useState<MatchListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const tripData = await getFuelShareByIdApi(id);
      setTrip(tripData);

      // Verify creator ownership
      if (user && tripData.creator_id !== user.id) {
        setError('Only the creator of this Fuel Share can view matching recommendations.');
        setLoading(false);
        return;
      }

      const res = await getMatchesApi(id);
      setMatchData(res);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to calculate trip matches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchMatches();
    }
  }, [id, user]);

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider font-semibold text-indigo-600">
              Rule-Based Matching Engine
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
              Compatible Fuel Shares
            </h1>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push(`/fuel-shares/${id}`)}>
            ← Back to Trip
          </Button>
        </div>

        {error && <ErrorAlert message={error} onRetry={fetchMatches} />}

        {/* Source Trip Summary Banner */}
        {trip && (
          <Card className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white border-none shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                  Your Offer #{trip.id}
                </span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">
                  {trip.source_name} → {trip.destination_name}
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  📅 {trip.departure_date} at {trip.departure_time} • {trip.estimated_distance} km • {trip.available_seats} seats available
                </p>
              </div>

              {matchData && (
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-center border border-white/10 shrink-0">
                  <span className="text-xs text-indigo-200 block">Matches Found</span>
                  <span className="text-2xl font-black text-emerald-400">{matchData.total_matches}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Matches List */}
        {loading ? (
          <LoadingSpinner message="Calculating route compatibility and spatial proximity..." />
        ) : !matchData || matchData.matches.length === 0 ? (
          <Card className="text-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-2xl mx-auto mb-3">
              🔍
            </div>
            <h3 className="text-lg font-bold text-slate-900">No compatible Fuel Shares found yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Our matching engine filters trips based on spatial route proximity, time windows, and available seats. Try checking back later or adjusting your departure schedule.
            </p>
            <Button variant="outline" size="sm" onClick={fetchMatches}>
              🔄 Refresh Matches
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>Showing matches above threshold ({matchData.match_threshold}%)</span>
              <span>Sorted by compatibility score</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {matchData.matches.map((matchItem) => (
                <MatchCard key={matchItem.fuel_share_id} match={matchItem} />
              ))}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
