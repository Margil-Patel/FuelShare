import { apiFetch, setAuthToken, removeAuthToken } from './client';
import { AuthTokenResponse, User } from './types';

export async function loginApi(email: string, password: string): Promise<AuthTokenResponse> {
  const data = await apiFetch<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function registerApi(
  name: string,
  email: string,
  password: string,
  phone?: string
): Promise<User> {
  return apiFetch<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password, phone: phone || null }),
  });
}

export async function getMeApi(): Promise<User> {
  return apiFetch<User>('/users/me');
}

export function logoutApi(): void {
  removeAuthToken();
}
