// Offline storage for bookmarked articles using IndexedDB
// This enables reading saved articles without internet connection

import { writable, derived } from 'svelte/store';
import type { Article, ReaderData } from '../types';

const DB_NAME = 'FeedStreamOffline';
const DB_VERSION = 1;
const STORE_ARTICLES = 'articles';
const STORE_CONTENT = 'content';

interface OfflineArticle extends Article {
    cachedAt: number;
    readerContent?: ReaderData | null;
}

interface OfflineContent {
    itemId: string;
    readerData: ReaderData;
    cachedAt: number;
}

// State
export const offlineArticles = writable<Map<string, OfflineArticle>>(new Map());
export const isOffline = writable(!navigator.onLine);
export const syncStatus = writable<'idle' | 'syncing' | 'error'>('idle');

let db: IDBDatabase | null = null;

// Initialize IndexedDB
async function initDB(): Promise<IDBDatabase> {
    if (db) return db;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // Articles store
            if (!database.objectStoreNames.contains(STORE_ARTICLES)) {
                const articleStore = database.createObjectStore(STORE_ARTICLES, { keyPath: 'id' });
                articleStore.createIndex('feed_url', 'feed_url', { unique: false });
                articleStore.createIndex('cachedAt', 'cachedAt', { unique: false });
            }

            // Content store
            if (!database.objectStoreNames.contains(STORE_CONTENT)) {
                const readerContentStore = database.createObjectStore(STORE_CONTENT, { keyPath: 'itemId' });
                readerContentStore.createIndex('cachedAt', 'cachedAt', { unique: false });
            }
        };
    });
}

// Add or update an article in offline storage
export async function cacheArticle(article: Article): Promise<void> {
    try {
        const database = await initDB();
        const tx = database.transaction(STORE_ARTICLES, 'readwrite');
        const store = tx.objectStore(STORE_ARTICLES);

        const offlineArticle: OfflineArticle = {
            ...article,
            cachedAt: Date.now(),
            readerContent: null,
        };

        store.put(offlineArticle);

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        // Update in-memory store
        offlineArticles.update(map => map.set(article.id, offlineArticle));
    } catch (error) {
        console.error('Failed to cache article:', error);
        throw error;
    }
}

// Add or update article readerContent (reader view) in offline storage
export async function cacheArticleContent(itemId: string, readerData: ReaderData): Promise<void> {
    try {
        const database = await initDB();
        const tx = database.transaction(STORE_CONTENT, 'readwrite');
        const store = tx.objectStore(STORE_CONTENT);

        const offlineContent: OfflineContent = {
            itemId,
            readerData,
            cachedAt: Date.now(),
        };

        store.put(offlineContent);

        await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });

        // Update in-memory store
        offlineArticles.update(map => {
            const article = map.get(itemId);
            if (article) {
                map.set(itemId, { ...article, readerContent: readerData });
            }
            return map;
        });
    } catch (error) {
        console.error('Failed to cache article readerContent:', error);
        throw error;
    }
}

// Remove an article from offline storage
export async function removeCachedArticle(itemId: string): Promise<void> {
    try {
        const database = await initDB();

        // Remove from articles store
        const tx1 = database.transaction(STORE_ARTICLES, 'readwrite');
        tx1.objectStore(STORE_ARTICLES).delete(itemId);

        // Remove from readerContent store
        const tx2 = database.transaction(STORE_CONTENT, 'readwrite');
        tx2.objectStore(STORE_CONTENT).delete(itemId);

        await Promise.all([
            new Promise<void>((resolve, reject) => {
                tx1.oncomplete = () => resolve();
                tx1.onerror = () => reject(tx1.error);
            }),
            new Promise<void>((resolve, reject) => {
                tx2.oncomplete = () => resolve();
                tx2.onerror = () => reject(tx2.error);
            }),
        ]);

        // Update in-memory store
        offlineArticles.update(map => {
            map.delete(itemId);
            return map;
        });
    } catch (error) {
        console.error('Failed to remove cached article:', error);
        throw error;
    }
}

// Get all cached articles
export async function getAllCachedArticles(): Promise<OfflineArticle[]> {
    try {
        const database = await initDB();
        const tx = database.transaction(STORE_ARTICLES, 'readonly');
        const store = tx.objectStore(STORE_ARTICLES);
        const request = store.getAll();

        return new Promise<OfflineArticle[]>((resolve, reject) => {
            request.onsuccess = () => {
                const articles = request.result as OfflineArticle[];
                // Update in-memory store
                offlineArticles.set(new Map(articles.map(a => [a.id, a])));
                resolve(articles);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to get cached articles:', error);
        return [];
    }
}

// Get cached readerContent for an article
export async function getCachedContent(itemId: string): Promise<ReaderData | null> {
    try {
        const database = await initDB();
        const tx = database.transaction(STORE_CONTENT, 'readonly');
        const store = tx.objectStore(STORE_CONTENT);
        const request = store.get(itemId);

        return new Promise<ReaderData | null>((resolve, reject) => {
            request.onsuccess = () => {
                const result = request.result as OfflineContent | undefined;
                if (result) {
                    // Update in-memory store
                    offlineArticles.update(map => {
                        const article = map.get(itemId);
                        if (article) {
                            map.set(itemId, { ...article, readerContent: result.readerData });
                        }
                        return map;
                    });
                    resolve(result.readerData);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to get cached readerContent:', error);
        return null;
    }
}

// Clear all cached data
export async function clearAllCache(): Promise<void> {
    try {
        const database = await initDB();

        await Promise.all([
            new Promise<void>((resolve, reject) => {
                const tx = database.transaction(STORE_ARTICLES, 'readwrite');
                tx.objectStore(STORE_ARTICLES).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            }),
            new Promise<void>((resolve, reject) => {
                const tx = database.transaction(STORE_CONTENT, 'readwrite');
                tx.objectStore(STORE_CONTENT).clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            }),
        ]);

        offlineArticles.set(new Map());
    } catch (error) {
        console.error('Failed to clear cache:', error);
        throw error;
    }
}

// Derived store for cached articles count
export const cachedCount = derived(offlineArticles, ($offlineArticles) => $offlineArticles.size);

// Check if an article is cached
export function isArticleCached(itemId: string): boolean {
    let cached = false;
    offlineArticles.subscribe(map => {
        cached = map.has(itemId);
    })();
    return cached;
}

// Monitor online/offline status
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        isOffline.set(false);
        syncStatus.set('idle');
    });

    window.addEventListener('offline', () => {
        isOffline.set(true);
    });

    // Load cached articles on init
    getAllCachedArticles().catch(console.error);
}
