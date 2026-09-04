import { apiFetch } from './client';
import { JoinRequest } from './types';

export async function joinFuelShareApi(fuelShareId: number): Promise<JoinRequest> {
  return apiFetch<JoinRequest>(`/fuel-shares/${fuelShareId}/join`, {
    method: 'POST',
  });
}

export async function getIncomingRequestsApi(fuelShareId: number): Promise<JoinRequest[]> {
  return apiFetch<JoinRequest[]>(`/fuel-shares/${fuelShareId}/requests`);
}

export async function getMyJoinRequestsApi(): Promise<JoinRequest[]> {
  return apiFetch<JoinRequest[]>('/users/me/join-requests');
}

export async function acceptJoinRequestApi(requestId: number): Promise<JoinRequest> {
  return apiFetch<JoinRequest>(`/join-requests/${requestId}/accept`, {
    method: 'PUT',
  });
}

export async function rejectJoinRequestApi(requestId: number): Promise<JoinRequest> {
  return apiFetch<JoinRequest>(`/join-requests/${requestId}/reject`, {
    method: 'PUT',
  });
}

export async function cancelJoinRequestApi(requestId: number): Promise<JoinRequest> {
  return apiFetch<JoinRequest>(`/join-requests/${requestId}`, {
    method: 'DELETE',
  });
}
