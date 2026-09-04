import { apiFetch } from './client';
import { DashboardResponse } from './types';

export async function getDashboardImpactApi(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>('/dashboard');
}
