// Feeds store - manages feed state and operations
import { writable, derived } from 'svelte/store';
import type { Feed } from '$lib/types';
import * as feedsApi from '$lib/api/feeds';
import * as foldersApi from '$lib/api/folders';
import { confirmDialog } from '$lib/stores/confirm';

// State
export const feeds = writable<Feed[]>([]);
export const feedsLoading = writable(false);
export const feedsError = writable<string | null>(null);

export const refreshState = writable({
    isRefreshing: false,
    current: 0,
    total: 0,
    message: '',
    error: null as string | null
});

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

// Refresh logic
const MAX_POLL_ATTEMPTS = 300; // 5 minutes max (with exponential backoff)
const INITIAL_POLL_INTERVAL = 1000; // Start with 1 second
const MAX_POLL_INTERVAL = 5000; // Max 5 seconds between polls

let refreshPollTimer: ReturnType<typeof setTimeout> | null = null;
let activeJobId: string | null = null;
let pollAttempts = 0;

async function pollRefreshStatus(jobId: string) {
    // If already polling for this job, ignore
    if (activeJobId === jobId && refreshPollTimer) return;

    // If polling for a different job, stop the old one
    if (refreshPollTimer) {
        clearTimeout(refreshPollTimer);
        refreshPollTimer = null;
    }

    activeJobId = jobId;
    pollAttempts = 0;
    refreshState.update(s => ({ ...s, isRefreshing: true, message: 'Starting refresh...', error: null }));

    const poll = async () => {
        try {
            pollAttempts++;

            // Timeout after max attempts
            if (pollAttempts > MAX_POLL_ATTEMPTS) {
                throw new Error('Refresh polling timeout - exceeded maximum attempts');
            }

            const response = await fetch(`/api/refresh/status?jobId=${encodeURIComponent(jobId)}`);
            if (!response.ok) throw new Error('Status check failed');

            const data = await response.json();

            if (data.status === 'done' || data.status === 'error') {
                stopPolling();
                await loadFeeds();
                return;
            }

            refreshState.update(s => ({
                ...s,
                current: data.current,
                total: data.total,
                message: data.message || `Refreshing... ${data.current}/${data.total}`,
                error: null
            }));

            // Continue polling if still active - use exponential backoff
            if (activeJobId === jobId) {
                // Exponential backoff: min(INITIAL * 1.5^attempt, MAX)
                const backoffInterval = Math.min(
                    INITIAL_POLL_INTERVAL * Math.pow(1.5, Math.min(pollAttempts / 10, 5)),
                    MAX_POLL_INTERVAL
                );
                refreshPollTimer = setTimeout(poll, backoffInterval);
            }
        } catch (e) {
            console.error('Polling error:', e);
            const errorMsg = e instanceof Error ? e.message : 'Polling error during refresh';
            refreshState.update(s => ({
                ...s,
                error: errorMsg,
                isRefreshing: false
            }));
            stopPolling();
        }
    };

    function stopPolling() {
        if (refreshPollTimer) {
            clearTimeout(refreshPollTimer);
            refreshPollTimer = null;
        }
        activeJobId = null;
        pollAttempts = 0;
        refreshState.update(s => ({ ...s, isRefreshing: false }));
    }

    // Start immediate first poll
    await poll();
}

export async function refreshFeed(url: string): Promise<void> {
    try {
        const { jobId } = await feedsApi.refreshFeed(url);
        if (!jobId) {
            throw new Error('No feed refresh job started');
        }
        pollRefreshStatus(jobId);
    } catch (e) {
        console.error('Failed to start refresh:', e);
        throw e;
    }
}

export async function refreshAll(): Promise<void> {
    try {
        const response = await feedsApi.refreshAllFeeds();
        const { jobId } = response;
        if (!jobId) {
            throw new Error('No feeds to refresh or failed to start refresh');
        }
        pollRefreshStatus(jobId);
    } catch (e) {
        console.error('Failed to start all-refresh:', e);
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
