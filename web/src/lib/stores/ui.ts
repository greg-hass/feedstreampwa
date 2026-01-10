// UI store - manages UI state (modals, mobile, view modes, etc.)
import { writable } from 'svelte/store';
import type { ViewMode, SmartFolder } from '$lib/types';

// Mobile state
export const isMobile = writable(false);
export const mobileMenuOpen = writable(false);
export const mobileActiveTab = writable<'all' | 'unread' | 'bookmarks' | 'feeds'>('all');

// View mode state
export const viewMode = writable<ViewMode>('all');
export const activeSmartFolder = writable<SmartFolder | null>(null);

// Modal state
export const showReader = writable(false);
export const showAddFeedModal = writable(false);
export const showSettings = writable(false);
export const showCreateFolderModal = writable(false);
export const showRenameFolderModal = writable(false);
export const showDeleteFolderConfirm = writable(false);
export const showManageFolderModal = writable(false);

// Add Feed modal state
export const addFeedTab = writable<'url' | 'search' | 'bulk'>('url');
export const addFeedUrl = writable('');
export const addFeedBulkUrls = writable('');
export const addFeedLoading = writable(false);
export const addFeedError = writable<string | null>(null);
export const selectedFolderIdsForNewFeed = writable<string[]>([]);

// Feed search state
export const feedSearchQuery = writable('');
export const feedSearchResults = writable<any[]>([]);
export const feedSearchLoading = writable(false);
export const feedSearchError = writable<string | null>(null);

// Folder modal state
export const folderModalName = writable('');
export const folderModalLoading = writable(false);
export const folderModalError = writable<string | null>(null);
export const selectedFolderForAction = writable<any>(null);
export const selectedFeedForFolderAction = writable<any>(null);

// Actions
export function openReader(): void {
    showReader.set(true);
}

export function closeReader(): void {
    showReader.set(false);
}

export function openAddFeedModal(): void {
    showAddFeedModal.set(true);
    addFeedTab.set('url');
    addFeedUrl.set('');
    addFeedBulkUrls.set('');
    addFeedError.set(null);
}

export function closeAddFeedModal(): void {
    showAddFeedModal.set(false);
    addFeedUrl.set('');
    addFeedBulkUrls.set('');
    addFeedError.set(null);
    addFeedLoading.set(false);
    selectedFolderIdsForNewFeed.set([]);
    feedSearchQuery.set('');
    feedSearchResults.set([]);
    feedSearchError.set(null);
}

export function openSettings(): void {
    showSettings.set(true);
}

export function closeSettings(): void {
    showSettings.set(false);
}

export function openCreateFolderModal(): void {
    showCreateFolderModal.set(true);
    folderModalName.set('');
    folderModalError.set(null);
}

export function closeCreateFolderModal(): void {
    showCreateFolderModal.set(false);
    folderModalName.set('');
    folderModalError.set(null);
}

export function setViewMode(mode: ViewMode): void {
    viewMode.set(mode);
}

export function setSmartFolder(folder: SmartFolder | null): void {
    activeSmartFolder.set(folder);
}

export function toggleMobileMenu(): void {
    mobileMenuOpen.update((open) => !open);
}

export function setMobileTab(tab: 'all' | 'unread' | 'bookmarks' | 'feeds'): void {
    mobileActiveTab.set(tab);
}
