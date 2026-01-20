import { fetchWithAuth } from '../utils/fetch';
import { getAuthToken as getToken, clearAuthData } from '$lib/stores/auth';

export interface AuthResponse {
  ok: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
  };
  error?: string;
}

export interface User {
  id: string;
  email: string;
  createdAt?: string;
  lastLogin?: string;
}

export interface RegisterData {
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function login(data: LoginData): Promise<AuthResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

export async function getCurrentUser(): Promise<{ ok: boolean; user?: User; error?: string }> {
  const response = await fetchWithAuth('/api/auth/me');
  return response.json();
}

export function logout(): void {
  clearAuthData();
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export { getToken as getAuthToken };
