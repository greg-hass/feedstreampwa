import { writable } from 'svelte/store';

// Modal states
export const isAddFeedModalOpen = writable(false);
export const isSettingsModalOpen = writable(false);
export const isMobileMenuOpen = writable(false);

// View mode types
export type ViewMode = 'all' | 'unread' | 'bookmarks' | 'smart' | 'folder' | 'feed';
export type SmartFolder = 'rss' | 'youtube' | 'reddit' | 'podcast';

// View state
export const viewMode = writable<ViewMode>('all');
export const activeSmartFolder = writable<SmartFolder | null>(null);
export const activeFolderId = writable<string | null>(null);
export const selectedFeedUrl = writable<string | null>(null);

// View mode actions
export function setViewAll() {
    viewMode.set('all');
    activeSmartFolder.set(null);
    activeFolderId.set(null);
    selectedFeedUrl.set(null);
}

export function setViewUnread() {
    viewMode.set('unread');
    activeSmartFolder.set(null);
    activeFolderId.set(null);
    selectedFeedUrl.set(null);
}

export function setViewBookmarks() {
    viewMode.set('bookmarks');
    activeSmartFolder.set(null);
    activeFolderId.set(null);
    selectedFeedUrl.set(null);
}

export function setViewSmartFolder(folder: SmartFolder) {
    viewMode.set('smart');
    activeSmartFolder.set(folder);
    activeFolderId.set(null);
    selectedFeedUrl.set(null);
}

export function setViewFolder(folderId: string) {
    viewMode.set('folder');
    activeSmartFolder.set(null);
    activeFolderId.set(folderId);
    selectedFeedUrl.set(null);
}

export function setViewFeed(feedUrl: string) {
    viewMode.set('feed');
    activeSmartFolder.set(null);
    activeFolderId.set(null);
    selectedFeedUrl.set(feedUrl);
}
