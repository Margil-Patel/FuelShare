import { apiFetch } from './client';
import { MatchListResponse, CorridorMatchListResponse, CorridorMatchRecord } from './types';

/** Legacy endpoint-based matching (unchanged) */
export async function getMatchesApi(fuelShareId: number): Promise<MatchListResponse> {
  return apiFetch<MatchListResponse>(`/matches/${fuelShareId}`);
}

/** Passenger search: find rides matching a RideRequest via corridor algorithm */
export async function getCorridorMatchesForRequestApi(
  rideRequestId: number,
  params?: {
    buffer_m?: number;
    detour_max_km?: number;
    detour_max_pct?: number;
    time_window_minutes?: number;
  }
): Promise<CorridorMatchListResponse> {
  const q = new URLSearchParams();
  if (params?.buffer_m != null) q.set('buffer_m', String(params.buffer_m));
  if (params?.detour_max_km != null) q.set('detour_max_km', String(params.detour_max_km));
  if (params?.detour_max_pct != null) q.set('detour_max_pct', String(params.detour_max_pct));
  if (params?.time_window_minutes != null) q.set('time_window_minutes', String(params.time_window_minutes));
  const qs = q.toString();
  return apiFetch<CorridorMatchListResponse>(
    `/ride-requests/${rideRequestId}/corridor-matches${qs ? `?${qs}` : ''}`
  );
}

/** Rider view: find passenger requests matching a FuelShare route */
export async function getRiderCorridorMatchesApi(
  fuelShareId: number,
  params?: {
    buffer_m?: number;
    detour_max_km?: number;
    detour_max_pct?: number;
    time_window_minutes?: number;
  }
): Promise<CorridorMatchListResponse> {
  const q = new URLSearchParams();
  if (params?.buffer_m != null) q.set('buffer_m', String(params.buffer_m));
  if (params?.detour_max_km != null) q.set('detour_max_km', String(params.detour_max_km));
  if (params?.detour_max_pct != null) q.set('detour_max_pct', String(params.detour_max_pct));
  if (params?.time_window_minutes != null) q.set('time_window_minutes', String(params.time_window_minutes));
  const qs = q.toString();
  return apiFetch<CorridorMatchListResponse>(
    `/fuel-shares/${fuelShareId}/corridor-matches${qs ? `?${qs}` : ''}`
  );
}

/** Accept a proposed corridor match (rider action) */
export async function acceptCorridorMatchApi(matchId: number): Promise<CorridorMatchRecord> {
  return apiFetch<CorridorMatchRecord>(`/corridor-matches/${matchId}/accept`, { method: 'POST' });
}

/** Reject a proposed corridor match (rider action) */
export async function rejectCorridorMatchApi(matchId: number): Promise<CorridorMatchRecord> {
  return apiFetch<CorridorMatchRecord>(`/corridor-matches/${matchId}/reject`, { method: 'POST' });
}
