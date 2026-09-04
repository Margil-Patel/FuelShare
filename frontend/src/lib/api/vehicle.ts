import { apiFetch } from './client';
import { Vehicle, VehicleCreate } from './types';

export async function getVehiclesApi(): Promise<Vehicle[]> {
  return apiFetch<Vehicle[]>('/vehicles');
}

export async function createVehicleApi(vehicle: VehicleCreate): Promise<Vehicle> {
  return apiFetch<Vehicle>('/vehicles', {
    method: 'POST',
    body: JSON.stringify(vehicle),
  });
}

export async function deleteVehicleApi(vehicleId: number): Promise<void> {
  return apiFetch<void>(`/vehicles/${vehicleId}`, {
    method: 'DELETE',
  });
}
