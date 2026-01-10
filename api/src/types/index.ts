// API Types

export type FeedKind = 'youtube' | 'reddit' | 'podcast' | 'generic';

export interface Feed {
  url: string;
  kind: FeedKind;
  title: string | null;
  site_url: string | null;
  last_checked: string | null;
  last_status: number;
  last_error: string | null;
  icon_url: string | null;
  custom_title: string | null;
  unreadCount?: number;
  smartFolder?: 'rss' | 'youtube' | 'reddit' | 'podcast';
  folders?: string[];
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
  is_read: number;
  is_starred: number;
  playback_position: number;
  feed_icon_url?: string;
  feed_title?: string;
}

export interface Folder {
  id: string;
  name: string;
  created_at: string;
  feedCount?: number;
}

export interface RefreshJob {
  id: string;
  status: 'running' | 'done' | 'error';
  current: number;
  total: number;
  message?: string;
  startedAt: number;
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

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
