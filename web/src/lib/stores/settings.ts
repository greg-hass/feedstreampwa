// Settings store - manages app settings
import { writable } from 'svelte/store';
import type { Settings } from '../types';
import * as settingsApi from '../api/settings';

// State - include all settings fields with defaults
export const settings = writable<Settings>({
    sync_interval: 'off',
    gemini_api_key: ''
});
export const settingsLoading = writable(false);
export const settingsError = writable<string | null>(null);

// Default settings
const defaultSettings: Settings = {
    sync_interval: 'off',
    gemini_api_key: ''
};

// Actions
export async function loadSettings(): Promise<void> {
    settingsLoading.set(true);
    settingsError.set(null);

    try {
        const data = await settingsApi.fetchSettings();
        // Merge with defaults to ensure all fields exist
        settings.set({ ...defaultSettings, ...data });
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
