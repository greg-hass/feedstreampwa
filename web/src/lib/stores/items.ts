// Items/Articles store - manages article state and operations
import { writable, derived, get } from 'svelte/store';
import type { Article, TimeFilter } from '../types';
import * as itemsApi from '../api/items';

// State
export const items = writable<Article[]>([]);
export const itemsLoading = writable(false);
export const itemsError = writable<string | null>(null);
export const itemsTotal = writable(0);
export const searchQuery = writable('');
export const timeFilter = writable<TimeFilter>('all');

export const hasMore = writable(true);
export const currentOffset = writable(0);
const PAGE_SIZE = 50;

// Derived stores
export const bookmarkedCount = derived(items, ($items) =>
    $items.filter((i) => i.is_starred === 1).length
);

export const unreadCount = derived(items, ($items) =>
    $items.filter((i) => i.is_read === 0).length
);

// Actions
export async function loadItems(params: {
    feedUrl?: string;
    folderId?: string;
    smartFolder?: 'rss' | 'youtube' | 'reddit' | 'podcast';
    unreadOnly?: boolean;
    starredOnly?: boolean;
    refresh?: boolean; // New param to force reset
} = {}): Promise<void> {
    const isRefresh = params.refresh !== false; // Default to true if not specified, usually we call loadItems() to reset
    
    // If not refreshing (appending), check if we are already loading
    if (!isRefresh && get(itemsLoading)) return;

    itemsLoading.set(true);
    if (isRefresh) {
        itemsError.set(null);
        items.set([]);
        currentOffset.set(0);
        hasMore.set(true);
    }

    try {
        const query = get(searchQuery);
        const offset = get(currentOffset);

        // If searching, use search endpoint
        if (query.trim()) {
            const data = await itemsApi.searchItems(query, PAGE_SIZE, offset);
            
            if (isRefresh) {
                items.set(data.items);
            } else {
                items.update(current => [...current, ...data.items]);
            }
            
            itemsTotal.set(data.total);
            hasMore.set(data.items.length === PAGE_SIZE);
            currentOffset.update(n => n + PAGE_SIZE);
        } else {
            const data = await itemsApi.fetchItems({
                ...params,
                limit: PAGE_SIZE,
                offset: offset,
            });
            
            if (isRefresh) {
                items.set(data.items);
            } else {
                items.update(current => [...current, ...data.items]);
            }
            
            itemsTotal.set(data.total);
            hasMore.set(data.items.length === PAGE_SIZE);
            currentOffset.update(n => n + PAGE_SIZE);
        }
    } catch (err) {
        itemsError.set(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
        itemsLoading.set(false);
    }
}

export async function toggleRead(item: Article): Promise<void> {
    // Calculate new state
    const newReadState = item.is_read === 0;

    // Optimistic update
    items.update(($items) =>
        $items.map((i) =>
            i.id === item.id ? { ...i, is_read: newReadState ? 1 : 0 } : i
        )
    );

    try {
        await itemsApi.toggleItemRead(item.id, newReadState);
    } catch (err) {
        // Revert on error
        items.update(($items) =>
            $items.map((i) =>
                i.id === item.id ? { ...i, is_read: item.is_read } : i
            )
        );
        throw err;
    }
}

export async function toggleStar(item: Article): Promise<void> {
    // Calculate new state
    const newStarredState = item.is_starred === 0;

    // Optimistic update
    items.update(($items) =>
        $items.map((i) =>
            i.id === item.id ? { ...i, is_starred: newStarredState ? 1 : 0 } : i
        )
    );

    try {
        await itemsApi.toggleItemStar(item.id, newStarredState);
    } catch (err) {
        // Revert on error
        items.update(($items) =>
            $items.map((i) =>
                i.id === item.id ? { ...i, is_starred: item.is_starred } : i
            )
        );
        throw err;
    }
}

export async function markAllRead(feedUrl?: string): Promise<void> {
    await itemsApi.markAllAsRead(feedUrl);
    await loadItems();
}

export async function updateProgress(itemId: string | number, progress: number): Promise<void> {
    // Optimistic update
    items.update(($items) =>
        $items.map((i) => (i.id === itemId ? { ...i, progress } : i))
    );

    try {
        await itemsApi.updateVideoProgress(itemId, progress);
    } catch (err) {
        console.error('Failed to update progress:', err);
        // Don't revert - progress updates are non-critical
    }
}

export function setSearchQuery(query: string): void {
    searchQuery.set(query);
}

export function setTimeFilter(filter: TimeFilter): void {
    timeFilter.set(filter);
}
