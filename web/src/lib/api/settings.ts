// API utilities for settings and feed search
import type { Settings, FeedSearchResult } from '$lib/types';
import { fetchWithTimeout } from '$lib/utils/fetch';

const API_BASE = '/api';

export async function fetchSettings(): Promise<Settings> {
    const response = await fetchWithTimeout(`${API_BASE}/settings`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.settings || { sync_interval: 'off' };
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function searchFeeds(query: string): Promise<FeedSearchResult[]> {
    const response = await fetchWithTimeout(
        `${API_BASE}/feeds/search?q=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results || [];
}
