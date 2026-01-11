// Folders store - manages folder state and operations
import { writable, derived, get } from 'svelte/store';
import type { Folder } from '$lib/types';
import * as foldersApi from '$lib/api/folders';
import { feeds } from './feeds';
import { confirmDialog } from './confirm';

// State
export const folders = writable<Folder[]>([]);
export const foldersLoading = writable(false);
export const foldersError = writable<string | null>(null);

// Derived stores
export const folderUnreadCounts = derived([folders, feeds], ([$folders, $feeds]) =>
    $folders.reduce(
        (acc, folder) => {
            const unread = $feeds
                .filter((f) => f.folders && f.folders.includes(folder.id))
                .reduce((sum, feed) => sum + (feed.unreadCount || 0), 0);
            acc[folder.id] = unread;
            return acc;
        },
        {} as Record<string, number>
    )
);

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
