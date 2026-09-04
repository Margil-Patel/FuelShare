import { apiFetch } from './client';
import { User } from './types';

export async function getUserProfileApi(): Promise<User> {
  return apiFetch<User>('/users/me');
}

export async function updateUserProfileApi(data: { name?: string; phone?: string }): Promise<User> {
  return apiFetch<User>('/users/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
