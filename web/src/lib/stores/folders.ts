// Folders store - manages folder state and operations
import { writable } from 'svelte/store';
import type { Folder } from '$lib/types';
import * as foldersApi from '$lib/api/folders';
import { confirmDialog } from './confirm';

// State
export const folders = writable<Folder[]>([]);
export const foldersLoading = writable(false);
export const foldersError = writable<string | null>(null);

// Actions
export async function loadFolders(): Promise<void> {
    foldersLoading.set(true);
    foldersError.set(null);

    try {
        const data = await foldersApi.fetchFolders();
        folders.set(data);
    } catch (err) {
        foldersError.set(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
        foldersLoading.set(false);
    }
}

export async function createFolder(name: string): Promise<void> {
    await foldersApi.createFolder(name);
    await loadFolders();
}

export async function renameFolder(id: string, name: string): Promise<void> {
    await foldersApi.renameFolder(id, name);
    await loadFolders();
}

export async function deleteFolder(id: string): Promise<void> {
    const confirmed = await confirmDialog.confirm({
        title: 'Delete Folder',
        message: 'Delete this folder? Feeds will not be deleted.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger',
    });

    if (!confirmed) return;

    await foldersApi.deleteFolder(id);
    await loadFolders();
}

// Type exports for convenience
export type { Folder } from '$lib/types';
