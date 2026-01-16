// API utilities for feeds
import type { Feed } from '$lib/types';
import { fetchWithTimeout } from '$lib/utils/fetch';

const API_BASE = '/api';
const API_TIMEOUT = 30000; // 30 seconds

export async function fetchFeeds(): Promise<Feed[]> {
    const response = await fetchWithTimeout(`${API_BASE}/feeds`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.feeds || [];
}

export async function createFeed(
    url: string,
    folderIds: string[] = [],
    title?: string
): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, folderIds, title }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function update(url: string, data: { title?: string }): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/feeds`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...data }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function deleteFeed(url: string): Promise<void> {
    const response = await fetchWithTimeout(
        `${API_BASE}/feeds?url=${encodeURIComponent(url)}`,
        { method: 'DELETE' }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function refreshFeed(url: string): Promise<{ jobId: string }> {
    const response = await fetchWithTimeout(`${API_BASE}/refresh/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [url] }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }

    return response.json();
}

export async function refreshAllFeeds(): Promise<{ jobId: string }> {
    const response = await fetchWithTimeout(`${API_BASE}/refresh/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }

    return response.json();
}

export interface FeedRecommendation {
    title: string;
    url: string;
    description: string;
    category: string;
    reason: string;
    confidence: number;
}

export interface FeedRecommendationsDebug {
    hasGeminiKey: boolean;
    hasDbKey: boolean;
    hasEnvKey: boolean;
    feedCount: number;
    feedsByKind: Record<string, number>;
    historyCount: number;
    readCount: number;
    starredCount: number;
    lastInteractionAt: string | null;
    model?: string;
    promptPreview?: string | null;
    lastError?: string | null;
}

export async function getFeedRecommendations(limit: number = 5): Promise<FeedRecommendation[]> {
    const response = await fetchWithTimeout(`${API_BASE}/feeds/recommendations?limit=${limit}`);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
    
    const data = await response.json();
    if (data.ok === false) {
        throw new Error(data.error || 'Failed to generate recommendations');
    }
    return data.recommendations || [];
}

export async function getFeedRecommendationsDebug(
    limit: number = 5
): Promise<{ recommendations: FeedRecommendation[]; debug: FeedRecommendationsDebug | null }> {
    const response = await fetchWithTimeout(
        `${API_BASE}/feeds/recommendations?limit=${limit}&debug=true&dryRun=true`
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }

    const data = await response.json();
    if (data.ok === false) {
        throw new Error(data.error || 'Failed to load recommendation debug data');
    }

    return {
        recommendations: data.recommendations || [],
        debug: data.debug || null
    };
}
