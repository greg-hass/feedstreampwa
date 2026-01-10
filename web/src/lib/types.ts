export interface Feed {
    id: number;
    url: string;
    title: string;
    description: string | null;
    icon_url: string | null;
    folder: string;
    type: 'rss' | 'youtube' | 'reddit';
    error_count: number;
    last_error: string | null;
    unreachable: boolean;
    created_at: string;
    updated_at: string;
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
    is_read: boolean;
    is_starred: boolean;
    feed_title: string;
    feed_icon_url: string | null;
}

export interface Folder {
    name: string;
    feeds: Feed[];
    unreadCount: number;
    isOpen: boolean;
}

export interface SearchResult {
    title: string;
    url: string;
    description: string;
    type: 'rss' | 'youtube' | 'reddit';
    thumbnail?: string;
}
