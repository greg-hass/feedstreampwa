// Frontend types - aligned with backend API responses

export type FeedKind = 'youtube' | 'reddit' | 'podcast' | 'generic';

export interface Feed {
    // Backend fields
    url: string;
    kind: FeedKind;
    title: string | null;
    site_url: string | null;
    last_checked: string | null;
    last_status: number;
    last_error: string | null;
    icon_url: string | null;
    custom_title: string | null;
    
    // Frontend-specific fields (added by API or computed)
    id?: number; // May be added by frontend
    description?: string | null; // Legacy field
    folder?: string; // Legacy field
    type?: 'rss' | 'youtube' | 'reddit' | 'podcast'; // Alias for kind
    error_count?: number; // Legacy field
    unreachable?: boolean; // Legacy field
    created_at?: string;
    updated_at?: string;
    unreadCount?: number;
    smartFolder?: 'rss' | 'youtube' | 'reddit' | 'podcast';
    folders?: string[];
}

export interface Item {
    // Backend fields (source of truth)
    id: string; // Changed from number to match backend
    feed_url: string;
    source: string; // Added - was missing!
    title: string | null;
    url: string | null;
    author: string | null;
    summary: string | null;
    content: string | null;
    published: string | null; // Changed from published_at to match backend
    updated: string | null;
    media_thumbnail: string | null;
    media_duration_seconds: number | null;
    external_id: string | null;
    raw_guid: string | null; // Backend uses raw_guid, not guid
    created_at: string;
    is_read: number; // Backend returns 0/1
    is_starred: number; // Backend returns 0/1
    playback_position: number; // Required in backend, not optional
    feed_icon_url?: string;
    feed_title?: string;
    
    // Frontend-specific fields (for compatibility)
    feed_id?: number; // Legacy field
    guid?: string; // Alias for raw_guid
    published_at?: string; // Alias for published
    enclosure?: {
        url: string;
        type?: string;
        length?: string;
    };
}

export interface Folder {
    id: string;
    name: string;
    created_at?: string;
    feedCount?: number;
    // Frontend-specific fields
    feeds?: Feed[];
    unreadCount?: number;
    isOpen?: boolean;
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
    // Backend fields (source of truth)
    url: string;
    title: string | null;
    byline: string | null;
    excerpt: string | null;
    siteName: string | null;
    imageUrl: string | null;
    contentHtml: string;
    fromCache: boolean;
    
    // Frontend-specific fields (for compatibility)
    content?: string; // Alias for contentHtml
    textContent?: string;
    length?: number;
}

export interface RefreshJob {
    id: string;
    status: 'running' | 'done' | 'error';
    current: number;
    total: number;
    message?: string;
    startedAt: number;
}
