import { writable } from 'svelte/store';

// Store to trigger showing onboarding from anywhere (e.g., settings)
export const showOnboarding = writable(false);

// Function to reset onboarding and show the welcome tour
export function resetOnboarding() {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('feedstream_onboarding_completed');
    }
    showOnboarding.set(true);
}
