// Feeds store - manages feed state and operations
import { writable, derived } from 'svelte/store';
import type { Feed } from '$lib/types';
import * as feedsApi from '$lib/api/feeds';
import { confirmDialog } from '$lib/stores/confirm';

// State
export const feeds = writable<Feed[]>([]);
export const feedsLoading = writable(false);
export const feedsError = writable<string | null>(null);

export const refreshState = writable({
    isRefreshing: false,
    current: 0,
    total: 0,
    message: ''
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
let refreshPollTimer: ReturnType<typeof setInterval> | null = null;

async function pollRefreshStatus(jobId: string) {
    if (refreshPollTimer) clearInterval(refreshPollTimer);

    refreshState.update(s => ({ ...s, isRefreshing: true }));

    refreshPollTimer = setInterval(async () => {
        try {
            const response = await fetch(`/api/refresh/status?jobId=${encodeURIComponent(jobId)}`);
            const data = await response.json();

            if (!response.ok || data.status === 'done' || data.status === 'error') {
                if (refreshPollTimer) clearInterval(refreshPollTimer);
                refreshState.update(s => ({ ...s, isRefreshing: false }));
                await loadFeeds();
                return;
            }

            refreshState.update(s => ({
                ...s,
                current: data.current,
                total: data.total,
                message: data.message
            }));
        } catch (e) {
            if (refreshPollTimer) clearInterval(refreshPollTimer);
            refreshState.update(s => ({ ...s, isRefreshing: false }));
        }
    }, 500);
}

export async function refreshFeed(url: string): Promise<void> {
    const { jobId } = await feedsApi.refreshFeed(url);
    pollRefreshStatus(jobId);
}

export async function refreshAll(): Promise<void> {
    const { jobId } = await feedsApi.refreshAllFeeds();
    pollRefreshStatus(jobId);
}

export async function addToFolder(feedUrl: string, folderId: string): Promise<void> {
    await feedsApi.addFeedToFolder(feedUrl, folderId);
    await loadFeeds();
}

export async function removeFromFolder(feedUrl: string, folderId: string): Promise<void> {
    await feedsApi.removeFeedFromFolder(feedUrl, folderId);
    await loadFeeds();
}

// Type exports for convenience
export type { Feed } from '$lib/types';