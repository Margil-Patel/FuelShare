import { apiFetch } from './client';
import { LocationSearchResult, ReverseGeocodeResult } from './types';

export interface DrivingRouteResult {
  distance_km: number;
  duration_mins: number;
  geometry: [number, number][];
}

export const searchLocationsApi = async (query: string, city?: string): Promise<LocationSearchResult[]> => {
  if (!query || query.trim().length < 2) return [];
  const cityParam = city ? `&city=${encodeURIComponent(city)}` : '';
  return apiFetch<LocationSearchResult[]>(`/locations/search?q=${encodeURIComponent(query)}${cityParam}`);
};

export const reverseGeocodeApi = async (lat: number, lon: number): Promise<ReverseGeocodeResult> => {
  return apiFetch<ReverseGeocodeResult>(`/locations/reverse?lat=${lat}&lon=${lon}`);
};

export async function fetchDrivingRouteApi(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<DrivingRouteResult | null> {
  if (lat1 === lat2 && lon1 === lon2) return null;
  const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const coords: [number, number][] = route.geometry.coordinates.map(
        ([lon, lat]: [number, number]) => [lat, lon]
      );
      return {
        distance_km: Math.round((route.distance / 1000) * 100) / 100,
        duration_mins: Math.round(route.duration / 60),
        geometry: coords,
      };
    }
  } catch {
    // Fallback if OSRM is unreachable
  }
  return null;
};
