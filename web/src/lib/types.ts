// Frontend types - aligned with backend API responses

export type FeedKind = 'youtube' | 'reddit' | 'podcast' | 'generic';

export interface Feed {
    url: string;
    kind: FeedKind;
    title: string | null;
    site_url: string | null;
    last_checked: string | null;
    last_status: number | null;
    last_error: string | null;
    icon_url: string | null;
    custom_title: string | null;
    unreadCount?: number;
    smartFolder?: 'rss' | 'youtube' | 'reddit' | 'podcast';
    folders?: string[];
    // Aliases for compatibility
    type?: FeedKind;
}

export interface Item {
    id: string;
    feed_url: string;
    source: string;
    title: string | null;
    url: string | null;
    author: string | null;
    summary: string | null;
    content: string | null;
    published: string | null;
    updated: string | null;
    media_thumbnail: string | null;
    media_duration_seconds: number | null;
    external_id: string | null;
    raw_guid: string | null;
    created_at: string;
    is_read: number; // 0 or 1
    is_starred: number; // 0 or 1
    playback_position: number;
    read_at?: string | null;
    feed_icon_url?: string;
    feed_title?: string;
    enclosure?: string | { url: string; type?: string; length?: string } | null;
    // Aliases for compatibility
    published_at?: string | null;
    feed_id?: string;
}

export type Article = Item;

export interface Folder {
    id: string;
    name: string;
    created_at: string;
    feedCount?: number;
}

export interface Discussion {
    url: string;
    title: string;
    score: number;
    commentsCount: number;
    source: 'hackernews' | 'reddit';
    subreddit?: string;
}

export interface AutomationRule {
    id?: string;
    name: string;
    keyword: string;
    field: 'title' | 'summary' | 'author';
    action: 'mark_read' | 'mark_starred' | 'mark_unread';
}

export interface Backup {
    id: string;
    filename: string;
    createdAt: string;
    size: number;
}

export interface ImportStatus {
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    total: number;
    current: number;
    currentName?: string;
    message?: string;
    error?: string;
}

export interface SearchResult {
    title: string;
    url: string;
    description: string;
    type: 'rss' | 'youtube' | 'reddit' | 'podcast';
    thumbnail?: string;
}

export type FeedSearchResult = SearchResult;

export interface Settings {
    sync_interval: string;
    gemini_api_key?: string;
    openai_api_key?: string;
    purge_retention?: string; // 'never' | '7' | '14' | '30' | '60' | '90' days
    [key: string]: string | undefined;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type FontFamily = 'sans' | 'serif' | 'mono';
export type ReadingWidth = 'narrow' | 'medium' | 'wide';
export type ReaderTheme = 'light' | 'sepia' | 'dark' | 'black';

export interface ReaderSettings {
    theme: ReaderTheme;
    fontSize: FontSize;
    fontFamily: FontFamily;
    readingWidth: ReadingWidth;
}

export type TimeFilter = 'all' | 'today' | '24h' | 'week';
export type ViewMode = 'all' | 'unread' | 'bookmarks' | 'smart' | 'folder' | 'feed';
export type SmartFolder = 'rss' | 'youtube' | 'reddit' | 'podcast';

export interface ImportResult {
    added: number;
    skipped: number;
    failed: { url: string; error: string }[];
}

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

export interface RefreshJob {
    id: string;
    status: 'running' | 'done' | 'error';
    current: number;
    total: number;
    message?: string;
    currentFeedTitle?: string;
    currentFeedUrl?: string;
    startedAt: number;
}
