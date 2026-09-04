import { apiFetch } from './client';
import { FuelCost } from './types';

export async function getFuelShareCostApi(
  fuelShareId: number,
  customFuelPrice?: number
): Promise<FuelCost> {
  const query = customFuelPrice ? `?fuel_price=${customFuelPrice}` : '';
  return apiFetch<FuelCost>(`/fuel-shares/${fuelShareId}/cost${query}`);
}
