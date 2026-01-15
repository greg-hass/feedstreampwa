import { z } from 'zod';

// Feed kinds
export const FeedKindSchema = z.enum(['generic', 'youtube', 'reddit', 'podcast']);
export type FeedKind = z.infer<typeof FeedKindSchema>;

// Feed object from database
export const FeedSchema = z.object({
    url: z.string().url(),
    kind: FeedKindSchema,
    title: z.string().nullable(),
    site_url: z.string().url().nullable(),
    last_checked: z.string().nullable(),
    last_status: z.number().nullable(),
    last_error: z.string().nullable(),
    icon_url: z.string().nullable(),
    custom_title: z.string().nullable(),
    etag: z.string().nullable().optional(),
    last_modified: z.string().nullable().optional(),
    unreadCount: z.number().optional(),
    smartFolder: z.enum(['rss', 'youtube', 'reddit', 'podcast']).optional(),
    folders: z.array(z.string()).optional()
});

export type Feed = z.infer<typeof FeedSchema>;

// API Request Schemas
export const AddFeedSchema = z.object({
    url: z.string().url(),
    refresh: z.boolean().optional().default(false),
    folderIds: z.array(z.string()).optional().default([]),
    title: z.string().optional().nullable()
});

export const RenameFeedSchema = z.object({
    url: z.string().url(),
    title: z.string().min(1)
});

export const SearchFeedsQuerySchema = z.object({
    q: z.string().min(1),
    type: z.string().optional().default('all')
});

export const RefreshFeedsSchema = z.object({
    urls: z.array(z.string().url()).optional()
});

export const RefreshStatusQuerySchema = z.object({
    jobId: z.string().min(1)
});

// System Schemas
export const SettingsSchema = z.record(z.string(), z.string());

// Item Schemas
export const ItemSchema = z.object({
    id: z.string(),
    feed_url: z.string().url(),
    source: z.string(),
    title: z.string().nullable(),
    url: z.string().url().nullable(),
    author: z.string().nullable(),
    summary: z.string().nullable(),
    content: z.string().nullable(),
    published: z.string().nullable(),
    updated: z.string().nullable(),
    read_at: z.string().nullable(),
    media_thumbnail: z.string().nullable(),
    media_duration_seconds: z.number().nullable(),
    external_id: z.string().nullable(),
    raw_guid: z.string().nullable(),
    created_at: z.string(),
    is_read: z.number().transform(n => n === 1),
    is_starred: z.number().transform(n => n === 1),
    playback_position: z.number().default(0),
    enclosure: z.string().nullable()
});

export type Item = z.infer<typeof ItemSchema>;

export const GetItemsQuerySchema = z.object({
    feed: z.string().optional(),
    source: z.string().optional(),
    smartFolder: z.string().optional(),
    folderId: z.string().optional(),
    unreadOnly: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    starredOnly: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
    limit: z.string().transform(Number).optional().default(20),
    offset: z.string().transform(Number).optional().default(0),
    q: z.string().optional()
});

export const MarkReadSchema = z.object({
    read: z.boolean()
});

export const MarkAllReadSchema = z.object({
    feedUrl: z.string().optional(),
    source: z.string().optional(),
    before: z.coerce.date().transform(d => d.toISOString()).optional()
});

export const StarItemSchema = z.object({
    starred: z.boolean()
});

export const PlaybackPositionSchema = z.object({
    position: z.number().min(0)
});

// Folder Schemas
export const FolderSchema = z.object({
    id: z.string(),
    name: z.string(),
    created_at: z.string()
});

export type Folder = z.infer<typeof FolderSchema>;

export const CreateFolderSchema = z.object({
    name: z.string().min(1).max(60)
});

export const UpdateFolderSchema = CreateFolderSchema;

export const FolderFeedSchema = z.object({
    feedUrl: z.string().url()
});

// Reader Schemas
export const ReaderQuerySchema = z.object({
    url: z.string().url()
});

export const PurgeReaderSchema = z.object({
    olderThanHours: z.number().min(1).optional()
});

// Rules Schemas
export const RuleSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    keyword: z.string(),
    field: z.string(),
    action: z.string(),
    feed_url: z.string().nullable(),
    created_at: z.string()
});

export type Rule = z.infer<typeof RuleSchema>;

export const CreateRuleSchema = z.object({
    name: z.string().optional(),
    keyword: z.string().min(1),
    field: z.string().min(1),
    action: z.string().min(1),
    feed_url: z.string().optional()
});

export const SummarizeItemSchema = z.object({
    itemId: z.string().min(1)
});

export const DiscussionQuerySchema = z.object({
    url: z.string().url()
});

