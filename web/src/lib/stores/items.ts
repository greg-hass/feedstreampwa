// Items/Articles store - manages article state and operations
import { writable, derived } from 'svelte/store';
import type { Article, TimeFilter } from '$lib/types';
import * as itemsApi from '$lib/api/items';

// State
export const items = writable<Article[]>([]);
export const itemsLoading = writable(false);
export const itemsError = writable<string | null>(null);
export const itemsTotal = writable(0);
export const searchQuery = writable('');
export const timeFilter = writable<TimeFilter>('all');

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
} = {}): Promise<void> {
    itemsLoading.set(true);
    itemsError.set(null);

    try {
        const query = searchQuery.subscribe((q) => q)();

        // If searching, use search endpoint
        if (query.trim()) {
            const data = await itemsApi.searchItems(query);
            items.set(data.items);
            itemsTotal.set(data.total);
        } else {
            const data = await itemsApi.fetchItems({
                ...params,
                limit: 100,
                offset: 0,
            });
            items.set(data.items);
            itemsTotal.set(data.total);
        }
    } catch (err) {
        itemsError.set(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
        itemsLoading.set(false);
    }
}

export async function toggleRead(item: Article): Promise<void> {
    // Optimistic update
    items.update(($items) =>
        $items.map((i) =>
            i.id === item.id ? { ...i, is_read: i.is_read === 0 ? 1 : 0 } : i
        )
    );

    try {
        await itemsApi.toggleItemRead(item.id);
    } catch (err) {
        // Revert on error
        items.update(($items) =>
            $items.map((i) =>
                i.id === item.id ? { ...i, is_read: i.is_read === 0 ? 1 : 0 } : i
            )
        );
        throw err;
    }
}

export async function toggleStar(item: Article): Promise<void> {
    // Optimistic update
    items.update(($items) =>
        $items.map((i) =>
            i.id === item.id ? { ...i, is_starred: i.is_starred === 0 ? 1 : 0 } : i
        )
    );

    try {
        await itemsApi.toggleItemStar(item.id);
    } catch (err) {
        // Revert on error
        items.update(($items) =>
            $items.map((i) =>
                i.id === item.id ? { ...i, is_starred: i.is_starred === 0 ? 1 : 0 } : i
            )
        );
        throw err;
    }
}

export async function markAllRead(feedUrl?: string): Promise<void> {
    await itemsApi.markAllAsRead(feedUrl);
    await loadItems();
}

export async function updateProgress(itemId: string, progress: number): Promise<void> {
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
