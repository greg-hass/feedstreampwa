// API utilities for folders
import type { Folder } from '$lib/types';
import { fetchWithTimeout } from '$lib/utils/fetch';

const API_BASE = '/api';

export async function fetchFolders(): Promise<Folder[]> {
    const response = await fetchWithTimeout(`${API_BASE}/folders`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.folders || [];
}

export async function createFolder(name: string): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function renameFolder(id: string, name: string): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/folders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function deleteFolder(id: string): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/folders/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}

export async function addFeedToFolder(
    feedUrl: string,
    folderId: string
): Promise<void> {
    const response = await fetchWithTimeout(`${API_BASE}/folders/${folderId}/feeds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl })
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
    const response = await fetchWithTimeout(`${API_BASE}/folders/${folderId}/feeds`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}
