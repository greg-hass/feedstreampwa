import { writable, get } from 'svelte/store';
import * as itemsApi from '$lib/api/items';
import type { Item, ReaderData } from '$lib/types';
import { toggleRead } from './items';
import { cacheArticleContent, getCachedContent, isOffline } from './offlineArticles';

export const showReader = writable(false);
export const readerLoading = writable(false);
export const readerError = writable<string | null>(null);
export const readerData = writable<ReaderData | null>(null);
export const currentItemUrl = writable<string | null>(null);
export const currentItem = writable<Item | null>(null);

const readerCache = new Map<string, ReaderData>();

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
    currentItemUrl.set(item.url);
    showReader.set(true);
    readerError.set(null);

    // Enable pinch-to-zoom for images in reader view
    if (typeof window !== 'undefined' && (window as any).setZoomEnabled) {
        (window as any).setZoomEnabled(true);
    }

    // For Reddit items, use the RSS content directly (Reddit blocks fetch requests)
    const isReddit = item.source === 'reddit' || (item.url && item.url.includes('reddit.com'));
    
    if (isReddit && (item.content || item.summary)) {
        const formattedData: ReaderData = {
            url: item.url,
            title: item.title,
            byline: item.author || null,
            excerpt: item.summary || null,
            siteName: 'Reddit',
            imageUrl: item.media_thumbnail || null,
            contentHtml: item.content || item.summary || '',
            fromCache: false
        };
        readerData.set(formattedData);
        readerCache.set(item.url, formattedData);
        readerLoading.set(false);
        return;
    }

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

        // Check if we got valid content
        if (!data || !data.contentHtml) {
            throw new Error('No content returned from reader API');
        }

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
        const errorMessage = err instanceof Error ? err.message : "Failed to load reader";
        console.error('Reader error:', errorMessage, 'for URL:', item.url);
        openOriginalUrl(item.url);
    } finally {
        readerLoading.set(false);
    }
}

// Helper function to open the original URL and close reader
function openOriginalUrl(url: string) {
    window.open(url, '_blank');
    closeReader();
}

export function closeReader() {
    showReader.set(false);
    readerData.set(null);
    readerError.set(null);
    currentItemUrl.set(null);
    currentItem.set(null);

    // Disable pinch-to-zoom when leaving reader
    if (typeof window !== 'undefined' && (window as any).setZoomEnabled) {
        (window as any).setZoomEnabled(false);
    }
}