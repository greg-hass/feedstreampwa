// Type definitions for FeedStream

export interface Feed {
    url: string;
    title: string;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
    unreadCount?: number;
    folders?: string[];
    favicon?: string;
}

export interface Article {
    id: string;
    title: string;
    url: string;
    content?: string;
    author?: string;
    published_at: string;
    feed_url: string;
    feed_title?: string;
    is_read: 0 | 1;
    is_starred: 0 | 1;
    source?: 'rss' | 'youtube' | 'reddit' | 'podcast';
    thumbnail?: string;
    video_id?: string;
    progress?: number;
}

export interface Folder {
    id: string;
    name: string;
    unreadCount?: number;
}

export interface ReaderData {
    title: string;
    byline?: string;
    content: string;
    textContent?: string;
    length?: number;
    excerpt?: string;
    siteName?: string;
}

export interface Settings {
    sync_interval: string;
}

export type ViewMode = 'all' | 'unread' | 'bookmarks' | 'smart' | 'folder' | 'feed';
export type SmartFolder = 'rss' | 'youtube' | 'reddit' | 'podcast';
export type TimeFilter = 'today' | '24h' | 'week' | 'all';

export interface FeedSearchResult {
    title: string;
    url: string;
    description: string;
    type: 'rss' | 'youtube' | 'reddit';
    thumbnail?: string;
}
