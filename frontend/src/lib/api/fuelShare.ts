import { apiFetch } from './client';
import { FuelShare, FuelShareCreate, FuelShareUpdate } from './types';

export async function getFuelSharesApi(filters?: {
  source?: string;
  destination?: string;
  departure_date?: string;
}): Promise<FuelShare[]> {
  const query = new URLSearchParams();
  if (filters?.source) query.set('source', filters.source);
  if (filters?.destination) query.set('destination', filters.destination);
  if (filters?.departure_date) query.set('departure_date', filters.departure_date);

  const queryString = query.toString();
  const endpoint = `/fuel-shares${queryString ? `?${queryString}` : ''}`;
  return apiFetch<FuelShare[]>(endpoint);
}

export async function getMyFuelSharesApi(): Promise<FuelShare[]> {
  return apiFetch<FuelShare[]>('/users/me/fuel-shares');
}

export async function getFuelShareByIdApi(id: number): Promise<FuelShare> {
  return apiFetch<FuelShare>(`/fuel-shares/${id}`);
}

export async function createFuelShareApi(fuelShare: FuelShareCreate): Promise<FuelShare> {
  return apiFetch<FuelShare>('/fuel-shares', {
    method: 'POST',
    body: JSON.stringify(fuelShare),
  });
}

export async function updateFuelShareApi(id: number, fuelShare: FuelShareUpdate): Promise<FuelShare> {
  return apiFetch<FuelShare>(`/fuel-shares/${id}`, {
    method: 'PUT',
    body: JSON.stringify(fuelShare),
  });
}

export async function deleteFuelShareApi(id: number): Promise<void> {
  return apiFetch<void>(`/fuel-shares/${id}`, {
    method: 'DELETE',
  });
}
