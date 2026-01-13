import { writable } from 'svelte/store';
import type { Feed } from '$lib/types';

// Modal states
export const isAddFeedModalOpen = writable(false);
export const isSettingsModalOpen = writable(false);
export const isMobileMenuOpen = writable(false);
export const isCreateFolderModalOpen = writable(false);
export const isDuplicatesModalOpen = writable(false);

export const renameModal = writable<{
    isOpen: boolean;
    type: 'folder' | 'feed';
    targetId: string;
    currentName: string;
}>({
    isOpen: false,
    type: 'folder',
    targetId: '',
    currentName: ''
});

export const feedFolderPopover = writable<{
    isOpen: boolean;
    feed: Feed | null;
    position: { x: number; y: number };
}>({
    isOpen: false,
    feed: null,
    position: { x: 0, y: 0 }
});

export const contextMenu = writable<{
    isOpen: boolean;
    type: 'folder' | 'feed';
    target: any;
    position: { x: number; y: number };
}>({
    isOpen: false,
    type: 'folder',
    target: null,
    position: { x: 0, y: 0 }
});

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

// View Density
export type ViewDensity = 'compact' | 'comfortable' | 'spacious';

function createDensityStore() {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('viewDensity') : null;
    const initial: ViewDensity = (stored as ViewDensity) || 'comfortable';
    
    const { subscribe, set } = writable<ViewDensity>(initial);
    
    return {
        subscribe,
        set: (value: ViewDensity) => {
            if (typeof window !== 'undefined') {
                localStorage.setItem('viewDensity', value);
            }
            set(value);
        }
    };
}

export const viewDensity = createDensityStore();
