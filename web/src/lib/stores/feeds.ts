// Feeds store - manages feed state and operations
import { writable, derived, get } from 'svelte/store';
import type { Feed } from '$lib/types';
import * as feedsApi from '$lib/api/feeds';
import * as foldersApi from '$lib/api/folders';
import { confirmDialog } from '$lib/stores/confirm';
import { settings } from '$lib/stores/settings';
import { logger } from '$lib/utils/logger';

// State
export const feeds = writable<Feed[]>([]);
export const feedsLoading = writable(false);
export const feedsError = writable<string | null>(null);

export const refreshState = writable({
    isRefreshing: false,
    current: 0,
    total: 0,
    message: '',
    currentFeedTitle: '',
    currentFeedUrl: '',
    error: null as string | null
});
export const refreshEvent = writable<RefreshEventPayload | null>(null);
export const refreshStream = writable({
    status: 'connecting' as 'connecting' | 'connected' | 'reconnecting'
});

const LAST_SYNC_KEY = 'last_global_sync';

// Derived stores
export const rssFeeds = derived(feeds, ($feeds) =>
    $feeds.filter((f) => f.kind === 'generic')
);

export const youtubeFeeds = derived(feeds, ($feeds) =>
    $feeds.filter((f) => f.kind === 'youtube')
);

export const redditFeeds = derived(feeds, ($feeds) =>
    $feeds.filter((f) => f.kind === 'reddit')
);

export const podcastFeeds = derived(feeds, ($feeds) =>
    $feeds.filter((f) => f.kind === 'podcast')
);

export const totalUnread = derived(feeds, ($feeds) =>
    $feeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0)
);

export const rssUnread = derived(rssFeeds, ($rssFeeds) =>
    $rssFeeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0)
);

export const youtubeUnread = derived(youtubeFeeds, ($youtubeFeeds) =>
    $youtubeFeeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0)
);

export const redditUnread = derived(redditFeeds, ($redditFeeds) =>
    $redditFeeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0)
);

export const podcastUnread = derived(podcastFeeds, ($podcastFeeds) =>
    $podcastFeeds.reduce((sum, feed) => sum + (feed.unreadCount || 0), 0)
);

// Actions
export async function loadFeeds(): Promise<void> {
    feedsLoading.set(true);
    feedsError.set(null);

    try {
        const data = await feedsApi.fetchFeeds();
        feeds.set(data);
    } catch (err) {
        feedsError.set(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
        feedsLoading.set(false);
    }
}

export async function addFeed(url: string, folderIds: string[] = []): Promise<void> {
    await feedsApi.createFeed(url, folderIds);
    await loadFeeds();
}

export async function removeFeed(url: string): Promise<void> {
    const confirmed = await confirmDialog.confirm({
        title: 'Delete Feed',
        message: `Are you sure you want to delete this feed?`,
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger',
    });

    if (!confirmed) return;

    await feedsApi.deleteFeed(url);
    await loadFeeds();
}

// Refresh logic (streamed from backend)
interface RefreshEventPayload {
    type: 'start' | 'progress' | 'complete' | 'error';
    jobId: string;
    current: number;
    total: number;
    message?: string;
    currentFeedTitle?: string;
    currentFeedUrl?: string;
    startedAt: number;
    lastSync?: number;
    source?: 'manual' | 'scheduler';
}

let refreshEventSource: EventSource | null = null;
let activeJobId: string | null = null;

function updateLastSync(lastSync?: number) {
    if (!lastSync) return;
    settings.update((s) => ({
        ...s,
        [LAST_SYNC_KEY]: lastSync.toString()
    }));
}

function shouldHandleEvent(payload: RefreshEventPayload): boolean {
    if (!payload?.jobId) return false;
    if (!activeJobId) return true;
    if (activeJobId === payload.jobId) return true;
    if (payload.type === 'start' && !get(refreshState).isRefreshing) return true;
    return false;
}

function handleRefreshEvent(payload: RefreshEventPayload) {
    refreshEvent.set(payload);
    if (!shouldHandleEvent(payload)) return;

    if (payload.type === 'start') {
        activeJobId = payload.jobId;
        updateLastSync(payload.lastSync);
        refreshState.update((s) => ({
            ...s,
            isRefreshing: true,
            current: payload.current ?? 0,
            total: payload.total ?? s.total,
            message: payload.message || 'Starting refresh...',
            currentFeedTitle: payload.currentFeedTitle || payload.currentFeedUrl || '',
            currentFeedUrl: payload.currentFeedUrl || '',
            error: null
        }));
        return;
    }

    if (payload.type === 'progress') {
        refreshState.update((s) => ({
            ...s,
            isRefreshing: true,
            current: payload.current ?? s.current,
            total: payload.total ?? s.total,
            message: payload.message || s.message || 'Refreshing...',
            currentFeedTitle: payload.currentFeedTitle || payload.currentFeedUrl || '',
            currentFeedUrl: payload.currentFeedUrl || '',
            error: null
        }));
        return;
    }

    if (payload.type === 'complete') {
        updateLastSync(payload.lastSync);
        refreshState.update((s) => ({
            ...s,
            isRefreshing: false,
            current: payload.current ?? s.current,
            total: payload.total ?? s.total,
            message: payload.message || 'Refresh completed',
            currentFeedTitle: '',
            currentFeedUrl: '',
            error: null
        }));
        activeJobId = null;
        loadFeeds();
        return;
    }

    if (payload.type === 'error') {
        refreshState.update((s) => ({
            ...s,
            isRefreshing: false,
            message: payload.message || s.message,
            currentFeedTitle: '',
            currentFeedUrl: '',
            error: payload.message || 'Refresh failed'
        }));
        activeJobId = null;
    }
}

export function startRefreshStream(): () => void {
    if (typeof window === 'undefined') return () => {};
    if (refreshEventSource) {
        logger.warn('Refresh stream already active, closing existing connection');
        refreshEventSource.close();
    }

    const source = new EventSource('/api/refresh/stream');
    refreshEventSource = source;
    refreshStream.set({ status: 'connecting' });

    source.addEventListener('refresh', (event) => {
        try {
            const payload = JSON.parse((event as MessageEvent).data) as RefreshEventPayload;
            handleRefreshEvent(payload);
        } catch (e) {
            logger.warn('Failed to parse refresh event', { error: e });
        }
    });

    source.addEventListener('sync', (event) => {
        try {
            const payload = JSON.parse((event as MessageEvent).data) as { lastSync?: number };
            updateLastSync(payload.lastSync);
        } catch (e) {
            logger.warn('Failed to parse sync event', { error: e });
        }
    });

    source.addEventListener('ping', () => {});

    source.onopen = () => {
        logger.info('Refresh stream connected');
        refreshStream.set({ status: 'connected' });
    };

    source.onerror = () => {
        logger.warn('Refresh stream error, attempting to reconnect');
        refreshStream.set({ status: 'reconnecting' });
    };

    return () => {
        logger.info('Closing refresh stream');
        source.close();
        refreshEventSource = null;
        refreshStream.set({ status: 'connecting' });
    };
}

export async function refreshFeed(url: string): Promise<string> {
    try {
        const { jobId } = await feedsApi.refreshFeed(url);
        if (!jobId) {
            throw new Error('No feed refresh job started');
        }
        activeJobId = jobId;
        refreshState.update((s) => ({
            ...s,
            isRefreshing: true,
            current: 0,
            total: s.total,
            message: 'Starting refresh...',
            currentFeedTitle: '',
            currentFeedUrl: '',
            error: null
        }));
        return jobId;
    } catch (e) {
        logger.error('Failed to start refresh', { error: e });
        throw e;
    }
}

export async function refreshAll(): Promise<string> {
    try {
        const response = await feedsApi.refreshAllFeeds();
        const { jobId } = response;
        if (!jobId) {
            throw new Error('No feeds to refresh or failed to start refresh');
        }
        activeJobId = jobId;
        refreshState.update((s) => ({
            ...s,
            isRefreshing: true,
            current: 0,
            total: s.total,
            message: 'Starting refresh...',
            currentFeedTitle: '',
            currentFeedUrl: '',
            error: null
        }));
        return jobId;
    } catch (e) {
        logger.error('Failed to start all-refresh', { error: e });
        throw e;
    }
}

export async function addToFolder(feedUrl: string, folderId: string): Promise<void> {
    await foldersApi.addFeedToFolder(feedUrl, folderId);
    await loadFeeds();
}

export async function removeFromFolder(feedUrl: string, folderId: string): Promise<void> {
    await foldersApi.removeFeedFromFolder(feedUrl, folderId);
    await loadFeeds();
}

// Type exports for convenience
export type { Feed } from '$lib/types';
