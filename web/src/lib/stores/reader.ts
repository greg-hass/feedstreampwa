import { writable, get } from 'svelte/store';
import * as itemsApi from '$lib/api/items';
import { toggleRead } from './items';
import { cacheArticleContent, getCachedContent, isOffline } from './offlineArticles';

export interface ReaderData {
    url: string;
    title: string | null;
    byline: string | null;
    excerpt: string | null;
    siteName: string | null;
    imageUrl: string | null;
    contentHtml: string;
    fromCache: boolean;
}

export const showReader = writable(false);
export const readerLoading = writable(false);
export const readerError = writable<string | null>(null);
export const readerData = writable<ReaderData | null>(null);
export const currentItemUrl = writable<string | null>(null);
export const currentItem = writable<any>(null);

const readerCache = new Map<string, ReaderData>();

export async function openReader(item: any) {
    if (!item.url) return;

    // Auto-mark as read
    if (item.is_read === 0) {
        toggleRead(item);
    }

    currentItem.set(item);
    currentItemUrl.set(item.url);
    showReader.set(true);
    readerError.set(null);

    // Check in-memory cache first
    const cached = readerCache.get(item.url);
    if (cached) {
        readerData.set(cached);
        readerLoading.set(false);
        return;
    }

    // Check offline IndexedDB cache if offline OR if this is a starred article
    if (get(isOffline) || item.is_starred === 1) {
        try {
            const offlineContent = await getCachedContent(item.id);
            if (offlineContent) {
                const formattedData: ReaderData = {
                    url: offlineContent.url,
                    title: item.title || offlineContent.title,
                    byline: offlineContent.byline,
                    excerpt: offlineContent.excerpt,
                    siteName: offlineContent.siteName,
                    imageUrl: offlineContent.imageUrl,
                    contentHtml: offlineContent.contentHtml,
                    fromCache: true
                };
                readerData.set(formattedData);
                readerCache.set(item.url, formattedData);
                readerLoading.set(false);
                return;
            }
        } catch (e) {
            console.error('Failed to load from offline cache:', e);
        }
    }

    readerLoading.set(true);
    readerData.set(null);

    try {
        const data = await itemsApi.fetchReaderContent(item.url);

        // Map API response to ReaderData interface
        const formattedData: ReaderData = {
            url: data.url,
            // Prefer the original item title as scrapers often pick up site titles for Reddit
            title: item.title || data.title,
            byline: data.byline,
            excerpt: data.excerpt,
            siteName: data.siteName,
            imageUrl: data.imageUrl,
            contentHtml: data.contentHtml,
            fromCache: data.fromCache || false
        };

        readerData.set(formattedData);
        readerCache.set(item.url, formattedData);

        // Cache for offline if this is a starred article
        if (item.is_starred === 1) {
            cacheArticleContent(item.id, formattedData).catch(console.error);
        }
    } catch (err) {
        readerError.set(err instanceof Error ? err.message : "Failed to load reader");
    } finally {
        readerLoading.set(false);
    }
}

export function closeReader() {
    showReader.set(false);
    readerData.set(null);
    readerError.set(null);
    currentItemUrl.set(null);
    currentItem.set(null);
}
