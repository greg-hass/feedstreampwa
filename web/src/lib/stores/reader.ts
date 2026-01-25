import { writable, get, derived } from 'svelte/store';
import { goto } from '$app/navigation';
import * as itemsApi from '$lib/api/items';
import type { Item, ReaderData } from '$lib/types';
import { toggleRead, items } from './items';
import { cacheArticleContent, getCachedContent, isOffline } from './offlineArticles';

// Legacy stores - kept for backward compatibility during migration
export const showReader = writable(false);
export const readerLoading = writable(false);
export const readerError = writable<string | null>(null);
export const readerData = writable<ReaderData | null>(null);
export const currentItemUrl = writable<string | null>(null);
export const currentItem = writable<Item | null>(null);

const readerCache = new Map<string, ReaderData>();

// Sync currentItem with items list updates
items.subscribe(($items) => {
    const current = get(currentItem);
    if (!current) return;
    const updated = $items.find(i => i.id === current.id);
    if (updated && (updated.is_starred !== current.is_starred || updated.is_read !== current.is_read)) {
        currentItem.set(updated);
    }
});

// Navigation state - derived from items list and currentItem
export const readerNavigation = derived(
    [items, currentItem],
    ([$items, $currentItem]) => {
        if (!$currentItem || $items.length === 0) {
            return { hasPrev: false, hasNext: false, currentIndex: -1, total: 0 };
        }

        const currentIndex = $items.findIndex(item => item.id === $currentItem.id);
        if (currentIndex === -1) {
            return { hasPrev: false, hasNext: false, currentIndex: -1, total: $items.length };
        }

        return {
            hasPrev: currentIndex > 0,
            hasNext: currentIndex < $items.length - 1,
            currentIndex,
            total: $items.length,
            prevItem: currentIndex > 0 ? $items[currentIndex - 1] : null,
            nextItem: currentIndex < $items.length - 1 ? $items[currentIndex + 1] : null,
        };
    }
);

// Navigate to previous article
export function navigateToPrev() {
    const nav = get(readerNavigation);
    if (nav.hasPrev && nav.prevItem) {
        openReader(nav.prevItem);
    }
}

// Navigate to next article
export function navigateToNext() {
    const nav = get(readerNavigation);
    if (nav.hasNext && nav.nextItem) {
        openReader(nav.nextItem);
    }
}

export async function openReader(item: Item) {
    if (!item.url) {
        console.error('No URL for item, opening nothing');
        return;
    }

    // Auto-mark as read
    if (item.is_read === 0) {
        toggleRead(item);
    }

    currentItem.set(item);

    // If it's desktop, we show it in the 3rd column (no navigation needed)
    // If it's mobile, we navigate to the reader route
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
        goto(`/reader/${item.id}`);
    } else {
        showReader.set(true); // This will trigger the ReaderView even in desktop layout
    }
}

// Legacy function for compatibility - navigates back to home
export function closeReader() {
    if (typeof window !== 'undefined') {
        window.history.back();
    }
}

// ===== Reading Position Persistence =====
const POSITION_STORAGE_KEY = 'feedstream-reading-positions';
const MAX_STORED_POSITIONS = 100; // LRU cache limit

interface ReadingPosition {
    itemId: string;
    scrollPercent: number;
    timestamp: number;
}

// Load positions from localStorage
function getStoredPositions(): ReadingPosition[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(POSITION_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Save positions to localStorage with LRU eviction
function savePositions(positions: ReadingPosition[]) {
    if (typeof window === 'undefined') return;
    try {
        // Sort by timestamp (newest first) and limit to MAX_STORED_POSITIONS
        const sorted = positions.sort((a, b) => b.timestamp - a.timestamp);
        const limited = sorted.slice(0, MAX_STORED_POSITIONS);
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(limited));
    } catch (e) {
        console.warn('Failed to save reading positions:', e);
    }
}

// Save reading position for current article
export function saveReadingPosition(itemId: string, scrollPercent: number) {
    if (!itemId || scrollPercent < 0.05) return; // Don't save if barely scrolled

    const positions = getStoredPositions();
    const existing = positions.findIndex(p => p.itemId === itemId);

    const newPosition: ReadingPosition = {
        itemId,
        scrollPercent,
        timestamp: Date.now()
    };

    if (existing >= 0) {
        positions[existing] = newPosition;
    } else {
        positions.push(newPosition);
    }

    savePositions(positions);
}

// Get saved reading position for an article
export function getReadingPosition(itemId: string): number | null {
    const positions = getStoredPositions();
    const found = positions.find(p => p.itemId === itemId);
    return found ? found.scrollPercent : null;
}

// Clear reading position when article is finished (scrolled to bottom)
export function clearReadingPosition(itemId: string) {
    const positions = getStoredPositions();
    const filtered = positions.filter(p => p.itemId !== itemId);
    savePositions(filtered);
}