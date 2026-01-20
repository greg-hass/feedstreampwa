import { writable, derived, get } from 'svelte/store';
import * as authApi from '../api/auth';
import { toast } from './toast';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_ID_KEY = 'user_id';
const USER_EMAIL_KEY = 'user_email';

export const isAuthenticated = writable(false);
export const currentUser = writable<{ id: string; email: string } | null>(null);
export const authLoading = writable(false);
export const authError = writable<string | null>(null);

export const isLoggedIn = derived(isAuthenticated, ($isAuthenticated) => $isAuthenticated);

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

function setAuthData(token: string, userId: string, userEmail: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(USER_ID_KEY, userId);
  localStorage.setItem(USER_EMAIL_KEY, userEmail);
}

export function clearAuthData(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);
}

export function initAuth(): void {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const userId = localStorage.getItem(USER_ID_KEY);
  const userEmail = localStorage.getItem(USER_EMAIL_KEY);

  if (token && userId && userEmail) {
    isAuthenticated.set(true);
    currentUser.set({ id: userId, email: userEmail });
  }
}

/**
 * Register a new user
 */
export async function register(email: string, password: string): Promise<void> {
  authLoading.set(true);
  authError.set(null);

  try {
    const response = await authApi.register({ email, password });

    if (response.ok && response.token && response.user) {
      setAuthData(response.token, response.user.id, response.user.email);

      isAuthenticated.set(true);
      currentUser.set(response.user);

      toast.success('Account created successfully!');
    } else {
      authError.set(response.error || 'Registration failed');
      toast.error(response.error || 'Registration failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Registration failed';
    authError.set(errorMessage);
    toast.error(errorMessage);
  } finally {
    authLoading.set(false);
  }
}

export async function login(email: string, password: string): Promise<void> {
  authLoading.set(true);
  authError.set(null);

  try {
    const response = await authApi.login({ email, password });

    if (response.ok && response.token && response.user) {
      setAuthData(response.token, response.user.id, response.user.email);

      isAuthenticated.set(true);
      currentUser.set(response.user);

      toast.success('Logged in successfully!');
    } else {
      authError.set(response.error || 'Login failed');
      toast.error(response.error || 'Login failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Login failed';
    authError.set(errorMessage);
    toast.error(errorMessage);
  } finally {
    authLoading.set(false);
  }
}

export function logout(): void {
  authApi.logout();

  clearAuthData();

  isAuthenticated.set(false);
  currentUser.set(null);
  authError.set(null);

  toast.success('Logged out successfully!');
}

/**
 * Fetch current user info
 */
export async function fetchCurrentUser(): Promise<void> {
  if (!get(isAuthenticated)) return;
  
  try {
    const response = await authApi.getCurrentUser();
    
    if (response.ok && response.user) {
      currentUser.set(response.user);
    } else {
      // Token invalid, logout
      logout();
    }
  } catch (error) {
    console.error('Failed to fetch current user:', error);
  }
}
