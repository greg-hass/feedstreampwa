// API utilities for feeds
import type { Feed } from '$lib/types';

const API_BASE = '/api';

export async function fetchFeeds(): Promise<Feed[]> {
    const response = await fetch(`${API_BASE}/feeds`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    return data.feeds || [];
}

export async function createFeed(
    url: string,
    folderIds: string[] = []
): Promise<void> {
    const response = await fetch(`${API_BASE}/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, folder_ids: folderIds }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function deleteFeed(url: string): Promise<void> {
    const response = await fetch(
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
    const response = await fetch(`${API_BASE}/refresh/start`, {
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
    const response = await fetch(`${API_BASE}/refresh/start`, {
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

export async function addFeedToFolder(
    feedUrl: string,
    folderId: string
): Promise<void> {
    const response = await fetch(`${API_BASE}/folders/${folderId}/feeds`, {
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

export async function removeFeedFromFolder(
    feedUrl: string,
    folderId: string
): Promise<void> {
    const response = await fetch(`${API_BASE}/folders/${folderId}/feeds`, {
        method: 'DELETE',
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
