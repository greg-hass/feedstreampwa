// API utilities for articles/items
import type { Article, ReaderData } from '../types';
import { fetchWithTimeout } from '$lib/utils/fetch';

const API_BASE = '/api';

export interface FetchItemsParams {
    feedUrl?: string;
    folderId?: string;
    smartFolder?: 'rss' | 'youtube' | 'reddit' | 'podcast';
    unreadOnly?: boolean;
    starredOnly?: boolean;
    limit?: number;
    offset?: number;
}

export async function fetchItems(params: FetchItemsParams = {}): Promise<{
    items: Article[];
    total: number;
}> {
    const searchParams = new URLSearchParams();

    // Backend uses 'feed', frontend types use 'feedUrl'
    if (params.feedUrl) searchParams.set('feed', params.feedUrl);
    if (params.folderId) searchParams.set('folderId', params.folderId);
    if (params.smartFolder) searchParams.set('smartFolder', params.smartFolder);
    if (params.unreadOnly) searchParams.set('unreadOnly', 'true');
    if (params.starredOnly) searchParams.set('starredOnly', 'true');
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());

    const response = await fetchWithTimeout(`${API_BASE}/items?${searchParams}`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        items: data.items || [],
        total: data.total || 0,
    };
}

export async function searchItems(query: string, limit = 100, offset = 0): Promise<{
    items: Article[];
    total: number;
}> {
    const params = new URLSearchParams({
        q: query.trim(),
        limit: limit.toString(),
        offset: offset.toString(),
    });

    const response = await fetchWithTimeout(`${API_BASE}/items?${params}`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        items: data.items || [],
        total: data.total || 0,
    };
}

export async function toggleItemRead(itemId: string, newReadState: boolean): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/items/${itemId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: newReadState }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function toggleItemStar(itemId: string, newStarredState: boolean): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/items/${itemId}/star`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: newStarredState }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function markAllAsRead(feedUrl?: string): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/items/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function fetchReaderContent(url: string): Promise<ReaderData> {
    const response = await fetchWithTimeout(
        `${API_BASE}/reader?url=${encodeURIComponent(url)}`
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

export async function updateVideoProgress(
    itemId: string,
    progress: number
): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/items/${itemId}/playback-position`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: progress }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function deleteItem(itemId: string): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/items/${itemId}`, {
        method: 'DELETE',
    });

    if (response.status === 404) {
        return;
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
}