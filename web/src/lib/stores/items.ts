// Items/Articles store - manages article state and operations
import { writable, derived, get } from 'svelte/store';
import type { Article, TimeFilter } from '../types';
import * as itemsApi from '../api/items';
import { cacheArticle, removeCachedArticle } from './offlineArticles';
import { logger } from '$lib/utils/logger';

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

// Track current params to detect context changes
let currentParamsString = '';

// Delta update tracking
export const lastItemsFetchTimestamp = writable<string | null>(null);

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
    timeFilter?: TimeFilter;
    refresh?: boolean;
    delta?: boolean; // Enable delta updates (only fetch new items since last fetch)
} = {}): Promise<void> {
    const isRefresh = params.refresh !== false;
    const isDelta = params.delta === true;
    const sinceTimestamp = isDelta ? get(lastItemsFetchTimestamp) : null;

    if (!isRefresh && !isDelta && get(itemsLoading)) return;

    // Detect context change
    const newParamsString = JSON.stringify({
        feedUrl: params.feedUrl,
        folderId: params.folderId,
        smartFolder: params.smartFolder,
        unreadOnly: params.unreadOnly,
        starredOnly: params.starredOnly,
        timeFilter: params.timeFilter ?? get(timeFilter),
        query: get(searchQuery)
    });

    const isContextChange = newParamsString !== currentParamsString;
    currentParamsString = newParamsString;

    itemsLoading.set(true);
    if (isRefresh && !isDelta) {
        itemsError.set(null);
        
        // Clear items if context changed to avoid showing wrong data
        if (isContextChange) {
            items.set([]);
        }
        
        currentOffset.set(0);
        hasMore.set(true);
    }

    try {
        const query = get(searchQuery);
        const filter = params.timeFilter ?? get(timeFilter);
        const offset = get(currentOffset);

        let data;
        if (query.trim()) {
            // Delta updates don't apply to search
            data = await itemsApi.searchItems(query, PAGE_SIZE, offset, filter);
        } else {
            data = await itemsApi.fetchItems({
                ...params,
                timeFilter: filter,
                limit: isDelta ? 1000 : PAGE_SIZE, // Higher limit for delta to catch all new items
                offset: isDelta ? 0 : offset,
                since: sinceTimestamp ?? undefined,
            });
        }

        // Update timestamp after successful fetch
        const fetchTimestamp = new Date().toISOString();
        lastItemsFetchTimestamp.set(fetchTimestamp);

        if (isDelta) {
            // Merge new items into existing items, avoiding duplicates
            items.update((currentItems) => {
                const existingIds = new Set(currentItems.map((i) => i.id));
                const newItems = data.items.filter((i) => !existingIds.has(i.id));
                return [...newItems, ...currentItems];
            });
        } else if (isRefresh) {
            items.set(data.items);
        } else {
            items.update((current) => [...current, ...data.items]);
        }

        itemsTotal.set(data.total);
        hasMore.set(data.items.length === PAGE_SIZE);
        currentOffset.update((n) => n + PAGE_SIZE);
    } catch (err) {
        itemsError.set(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
        itemsLoading.set(false);
    }
}

export async function toggleRead(item: Article): Promise<void> {
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
    const newStarredState = item.is_starred === 0;

    // Optimistic update
    items.update(($items) =>
        $items.map((i) =>
            i.id === item.id ? { ...i, is_starred: newStarredState ? 1 : 0 } : i
        )
    );

    try {
        await itemsApi.toggleItemStar(item.id, newStarredState);

        if (newStarredState) {
            cacheArticle(item).catch((err) => logger.warn('Failed to cache article', { error: err }));
        } else {
            removeCachedArticle(item.id).catch((err) => logger.warn('Failed to remove cached article', { error: err }));
        }
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

export function setSearchQuery(query: string): void {
    searchQuery.set(query);
}

export function setTimeFilter(filter: TimeFilter): void {
    timeFilter.set(filter);
}
