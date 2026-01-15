// Items/Articles store - manages article state and operations
import { writable, derived, get } from 'svelte/store';
import type { Article, TimeFilter } from '../types';
import * as itemsApi from '../api/items';
import { cacheArticle, removeCachedArticle } from './offlineArticles';

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
    refresh?: boolean;
} = {}): Promise<void> {
    const isRefresh = params.refresh !== false;
    
    if (!isRefresh && get(itemsLoading)) return;

    itemsLoading.set(true);
    if (isRefresh) {
        itemsError.set(null);
        // Don't clear items immediately to avoid flash
        // items.set([]); 
        currentOffset.set(0);
        hasMore.set(true);
    }

    try {
        const query = get(searchQuery);
        const offset = get(currentOffset);

        let data;
        if (query.trim()) {
            data = await itemsApi.searchItems(query, PAGE_SIZE, offset);
        } else {
            data = await itemsApi.fetchItems({
                ...params,
                limit: PAGE_SIZE,
                offset: offset,
            });
        }
        
        if (isRefresh) {
            items.set(data.items);
        } else {
            items.update(current => [...current, ...data.items]);
        }
        
        itemsTotal.set(data.total);
        hasMore.set(data.items.length === PAGE_SIZE);
        currentOffset.update(n => n + PAGE_SIZE);
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
            cacheArticle(item).catch(console.error);
        } else {
            removeCachedArticle(item.id).catch(console.error);
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