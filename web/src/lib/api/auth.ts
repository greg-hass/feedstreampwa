import { fetchWithAuth } from '../utils/fetch';

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

/**
 * Register a new user
 */
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

/**
 * Login with email and password
 */
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

/**
 * Get current user info
 */
export async function getCurrentUser(): Promise<{ ok: boolean; user?: User; error?: string }> {
  const response = await fetchWithAuth('/api/auth/me');
  return response.json();
}

/**
 * Logout (clears local storage)
 */
export function logout(): void {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_email');
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('auth_token');
}

/**
 * Get stored auth token
 */
export function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * Store auth token
 */
export function setAuthToken(token: string): void {
  localStorage.setItem('auth_token', token);
}
