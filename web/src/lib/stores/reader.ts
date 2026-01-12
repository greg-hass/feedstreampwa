import { writable } from 'svelte/store';
import * as itemsApi from '$lib/api/items';
import { toggleRead } from './items';

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

    // Check cache
    const cached = readerCache.get(item.url);
    if (cached) {
        readerData.set(cached);
        readerLoading.set(false);
        return;
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
