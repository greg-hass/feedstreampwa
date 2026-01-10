export interface Feed {
    id: number;
    url: string;
    title: string;
    description: string | null;
    icon_url: string | null;
    folder: string;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
    error_count: number;
    last_error: string | null;
    unreachable: boolean;
    created_at: string;
    updated_at: string;
    unreadCount?: number;
    kind?: string;
    smartFolder?: string;
    folders?: string[];
}

export interface Item {
    id: number;
    feed_id: number;
    guid: string;
    title: string;
    url: string;
    author: string | null;
    summary: string | null;
    content: string | null;
    published_at: string;
    created_at: string;
    is_read: number | boolean; // API might return 0/1, frontend uses bool sometimes
    is_starred: number | boolean;
    feed_title: string;
    feed_icon_url: string | null;
    published?: string; // alias if needed
    source?: string;
    media_thumbnail?: string;
}

export interface Folder {
    id: string; // or number depending on DB
    name: string;
    feeds: Feed[];
    unreadCount: number;
    isOpen: boolean;
    feedCount?: number;
}

export interface SearchResult {
    title: string;
    url: string;
    description: string;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
    thumbnail?: string;
}

export type FeedSearchResult = SearchResult;
export type Article = Item;

export interface Settings {
    theme: 'light' | 'dark' | 'system';
    sync_interval: string;
}

export type TimeFilter = 'all' | '24h' | '7d' | '30d';

export type ViewMode = 'all' | 'unread' | 'bookmarks' | 'smart' | 'folder' | 'feed';
export type SmartFolder = 'rss' | 'youtube' | 'reddit' | 'podcast';

export interface ImportResult {
    added: number;
    skipped: number;
    failed: { url: string; error: string }[];
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
