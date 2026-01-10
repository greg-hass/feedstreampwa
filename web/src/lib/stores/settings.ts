// Settings store - manages app settings
import { writable } from 'svelte/store';
import type { Settings } from '$lib/types';
import * as settingsApi from '$lib/api/settings';

// State
export const settings = writable<Settings>({ sync_interval: 'off' });
export const settingsLoading = writable(false);
export const settingsError = writable<string | null>(null);

// Actions
export async function loadSettings(): Promise<void> {
    settingsLoading.set(true);
    settingsError.set(null);

    try {
        const data = await settingsApi.fetchSettings();
        settings.set(data);
    } catch (err) {
        settingsError.set(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
        settingsLoading.set(false);
    }
}

export async function updateSyncInterval(interval: string): Promise<void> {
    try {
        await settingsApi.updateSettings({ sync_interval: interval });
        settings.update((s) => ({ ...s, sync_interval: interval }));
    } catch (err) {
        console.error('Failed to update settings:', err);
        throw err;
    }
}
