'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RouteMap } from './RouteMap';
import { CorridorMatchResult } from '@/lib/api/types';
import { acceptCorridorMatchApi, rejectCorridorMatchApi } from '@/lib/api/matching';

interface CorridorMatchCardProps {
  match: CorridorMatchResult;
  /** 'passenger' = show "Request to join", 'rider' = show "Accept / Reject" */
  viewMode: 'passenger' | 'rider';
  onJoin?: (matchId: number) => void;
  onAccepted?: (matchId: number) => void;
  onRejected?: (matchId: number) => void;
}

export const CorridorMatchCard: React.FC<CorridorMatchCardProps> = ({
  match,
  viewMode,
  onJoin,
  onAccepted,
  onRejected,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(match.match_status);

  const detourKm = (match.detour_distance_m / 1000).toFixed(2);
  const bufferC = Math.round(match.pickup_buffer_m);
  const bufferD = Math.round(match.drop_buffer_m);

  // Colour coding based on detour
  const detourColor = match.detour_distance_m < 500
    ? 'text-emerald-600'
    : match.detour_distance_m < 1500
    ? 'text-amber-600'
    : 'text-rose-600';

  const handleAccept = async () => {
    if (!match.match_id) return;
    setLoading(true);
    setActionError(null);
    try {
      await acceptCorridorMatchApi(match.match_id);
      setLocalStatus('ACCEPTED');
      onAccepted?.(match.match_id);
    } catch (e: any) {
      setActionError(e.detail ?? e.message ?? 'Failed to accept match.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!match.match_id) return;
    setLoading(true);
    setActionError(null);
    try {
      await rejectCorridorMatchApi(match.match_id);
      setLocalStatus('REJECTED');
      onRejected?.(match.match_id);
    } catch (e: any) {
      setActionError(e.detail ?? e.message ?? 'Failed to reject match.');
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (s: string) => {
    const styles: Record<string, string> = {
      PROPOSED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
      EXPIRED: 'bg-slate-100 text-slate-500 border-slate-200',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${styles[s] ?? styles.PROPOSED}`}>
        {s}
      </span>
    );
  };

  return (
    <Card className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          {viewMode === 'passenger' ? (
            <>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                {match.source_name} → {match.destination_name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Ride #{match.fuel_share_id}</p>
            </>
          ) : (
            <>
              <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                Passenger: {match.pickup_name} → {match.drop_name}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Request #{match.ride_request_id}</p>
            </>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {statusBadge(localStatus)}
          <span className="text-xs text-slate-400">
            {new Date(match.departure_datetime).toLocaleString('en-IN', {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Fare + Key Metrics */}
      <div className="grid grid-cols-2 gap-2 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-3">
        <div>
          <span className="text-xs text-slate-400 uppercase font-semibold block">Fare Estimate</span>
          <span className="text-xl font-black text-indigo-700">₹{match.fare_estimate.toFixed(2)}</span>
          <span className="text-xs text-slate-400 block">{match.fare_strategy === 'proportional' ? 'Distance-proportional' : 'Equal split'}</span>
        </div>
        <div>
          <span className="text-xs text-slate-400 uppercase font-semibold block">Detour Cost</span>
          <span className={`text-xl font-black ${detourColor}`}>{detourKm} km</span>
          <span className="text-xs text-slate-400 block">extra for driver</span>
        </div>
        <div>
          <span className="text-xs text-slate-400 uppercase font-semibold block">Pickup Buffer</span>
          <span className="font-bold text-slate-800">{bufferC} m</span>
          <span className="text-xs text-slate-400 block">from route</span>
        </div>
        <div>
          <span className="text-xs text-slate-400 uppercase font-semibold block">Drop Buffer</span>
          <span className="font-bold text-slate-800">{bufferD} m</span>
          <span className="text-xs text-slate-400 block">from route</span>
        </div>
      </div>

      {/* Position along route */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold">Route position:</span>
        <div className="flex-1 relative h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="absolute top-0 h-2 bg-orange-400 rounded-full"
            style={{
              left: `${match.pickup_fraction * 100}%`,
              width: `${(match.drop_fraction - match.pickup_fraction) * 100}%`,
            }}
          />
        </div>
        <span>{(match.pickup_fraction * 100).toFixed(0)}%–{(match.drop_fraction * 100).toFixed(0)}%</span>
      </div>

      {/* Expand map */}
      <button
        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold text-left flex items-center gap-1 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span>{expanded ? '▲' : '▼'}</span>
        {expanded ? 'Hide Map' : 'Show Route Map'}
      </button>

      {expanded && (
        <RouteMap
          routePolyline={match.route_polyline}
          origin={viewMode === 'passenger' ? { lat: 0, lng: 0, label: match.source_name } : undefined}
          destination={viewMode === 'passenger' ? { lat: 0, lng: 0, label: match.destination_name } : undefined}
          pickup={match.pickup_latitude ? {
            lat: match.pickup_latitude,
            lng: match.pickup_longitude,
            label: match.pickup_name,
          } : undefined}
          drop={match.drop_latitude ? {
            lat: match.drop_latitude,
            lng: match.drop_longitude,
            label: match.drop_name,
          } : undefined}
          bufferM={match.pickup_buffer_m}
          height="260px"
        />
      )}

      {actionError && (
        <p className="text-xs text-rose-600 font-medium bg-rose-50 rounded-lg px-3 py-2">{actionError}</p>
      )}

      {/* Actions */}
      {localStatus === 'PROPOSED' && (
        <div className="pt-2 border-t border-slate-100 flex gap-2 justify-end">
          {viewMode === 'passenger' && match.match_id && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onJoin?.(match.match_id!)}
            >
              🚗 Request to Join
            </Button>
          )}
          {viewMode === 'rider' && match.match_id && (
            <>
              <Button
                variant="danger"
                size="sm"
                isLoading={loading}
                onClick={handleReject}
              >
                Reject
              </Button>
              <Button
                variant="secondary"
                size="sm"
                isLoading={loading}
                onClick={handleAccept}
              >
                ✓ Accept — ₹{match.fare_estimate.toFixed(2)}
              </Button>
            </>
          )}
        </div>
      )}

      {localStatus === 'ACCEPTED' && (
        <div className="pt-2 border-t border-emerald-100 text-xs text-emerald-700 font-semibold bg-emerald-50 rounded-lg px-3 py-2">
          ✓ Match accepted! Passenger will receive payment details.
        </div>
      )}

      {localStatus === 'REJECTED' && (
        <div className="pt-2 border-t border-rose-100 text-xs text-rose-600 font-semibold bg-rose-50 rounded-lg px-3 py-2">
          ✗ Match rejected.
        </div>
      )}
    </Card>
  );
};
