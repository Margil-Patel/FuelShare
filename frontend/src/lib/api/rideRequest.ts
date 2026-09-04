import { apiFetch } from './client';
import { RideRequest, RideRequestCreate } from './types';

export async function createRideRequestApi(data: RideRequestCreate): Promise<RideRequest> {
  return apiFetch<RideRequest>('/ride-requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMyRideRequestsApi(): Promise<RideRequest[]> {
  return apiFetch<RideRequest[]>('/ride-requests/me');
}

export async function getRideRequestByIdApi(id: number): Promise<RideRequest> {
  return apiFetch<RideRequest>(`/ride-requests/${id}`);
}

export async function cancelRideRequestApi(id: number): Promise<RideRequest> {
  return apiFetch<RideRequest>(`/ride-requests/${id}`, { method: 'DELETE' });
}
