// Settings store - manages app settings
import { writable } from 'svelte/store';
import type { Settings } from '../types';
import * as settingsApi from '../api/settings';

// State - include all settings fields with defaults
export const settings = writable<Settings>({
    sync_interval: 'off',
    gemini_api_key: '',
    openai_api_key: ''
});
export const settingsLoading = writable(false);
export const settingsError = writable<string | null>(null);

// Default settings
const defaultSettings: Settings = {
    sync_interval: 'off',
    gemini_api_key: '',
    openai_api_key: ''
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

export async function updateGeminiApiKey(apiKey: string): Promise<void> {
    try {
        await settingsApi.updateSettings({ gemini_api_key: apiKey });
        settings.update((s) => ({ ...s, gemini_api_key: apiKey }));
    } catch (err) {
        console.error('Failed to update Gemini API key:', err);
        throw err;
    }
}

export async function updateOpenAIApiKey(apiKey: string): Promise<void> {
    try {
        await settingsApi.updateSettings({ openai_api_key: apiKey });
        settings.update((s) => ({ ...s, openai_api_key: apiKey }));
    } catch (err) {
        console.error('Failed to update OpenAI API key:', err);
        throw err;
    }
}
