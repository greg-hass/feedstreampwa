// API utilities for folders
import type { Folder } from '$lib/types';

const API_BASE = '/api';

export async function fetchFolders(): Promise<Folder[]> {
    const response = await fetch(`${API_BASE}/folders`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.folders || [];
}

export async function createFolder(name: string): Promise<void> {
    const response = await fetch(`${API_BASE}/folders`, {
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
    const response = await fetch(`${API_BASE}/folders/${id}`, {
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
    const response = await fetch(`${API_BASE}/folders/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            errorData.error || `HTTP ${response.status}: ${response.statusText}`
        );
    }
}
