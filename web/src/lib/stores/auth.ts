import { writable, derived, get } from 'svelte/store';
import * as authApi from '../api/auth';
import { toast } from './toast';

// State
export const isAuthenticated = writable(false);
export const currentUser = writable<{ id: string; email: string } | null>(null);
export const authLoading = writable(false);
export const authError = writable<string | null>(null);

// Derived state
export const isLoggedIn = derived(isAuthenticated, ($isAuthenticated) => $isAuthenticated);

/**
 * Initialize auth state from localStorage
 */
export function initAuth(): void {
  const token = localStorage.getItem('auth_token');
  const userId = localStorage.getItem('user_id');
  const userEmail = localStorage.getItem('user_email');
  
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
      // Store auth data
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user_id', response.user.id);
      localStorage.setItem('user_email', response.user.email);
      
      // Update state
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

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<void> {
  authLoading.set(true);
  authError.set(null);
  
  try {
    const response = await authApi.login({ email, password });
    
    if (response.ok && response.token && response.user) {
      // Store auth data
      localStorage.setItem('auth_token', response.token);
      localStorage.setItem('user_id', response.user.id);
      localStorage.setItem('user_email', response.user.email);
      
      // Update state
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

/**
 * Logout current user
 */
export function logout(): void {
  authApi.logout();
  
  // Clear state
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
