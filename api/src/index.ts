import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import Database from 'better-sqlite3';
import Parser from 'rss-parser';
import pLimit from 'p-limit';
import { createHash } from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import sanitizeHtml from 'sanitize-html';
import { searchFeeds } from './feed-search.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DB_PATH = process.env.DB_PATH || '/data/feedstream.sqlite';
const FETCH_TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || '12000', 10);
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '6', 10);
const READER_CACHE_TTL_HOURS = 168; // 7 days

// Helper: Check if reader cache entry is fresh
function isCacheFresh(updatedAtIso: string): boolean {
    const updatedAt = new Date(updatedAtIso).getTime();
    const now = Date.now();
    const ttlMs = READER_CACHE_TTL_HOURS * 60 * 60 * 1000;
    return now - updatedAt < ttlMs;
}

// Sanitize-html options for reader content
const sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'em', 'strong', 'hr', 'br', 'h2', 'h3'],
    allowedAttributes: {
        'a': ['href', 'title']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard'
};

// Refresh job tracking
interface RefreshJob {
    id: string;
    status: 'running' | 'done' | 'error';
    current: number;
    total: number;
    message?: string;
    startedAt: number;
}

const refreshJobs = new Map<string, RefreshJob>();
const MAX_JOBS = 5;

// Settings and Background Sync
let backgroundSyncTimer: NodeJS.Timeout | null = null;
const SYNC_INTERVAL_KEY = 'sync_interval';
const LAST_SYNC_KEY = 'last_global_sync';

function parseInterval(interval: string): number | null {
    if (interval === 'off') return null;
    const match = interval.match(/^(\d+)([mhd])$/);
    if (!match) return null;
    const val = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 'h') return val * 60 * 60 * 1000;
    if (unit === 'd') return val * 24 * 60 * 60 * 1000;
    return null;
}

async function startBackgroundSync() {
    fastify.log.info('Starting background sync runner...');

    // Run every minute to check if sync is due
    backgroundSyncTimer = setInterval(async () => {
        try {
            const intervalSetting = db.prepare('SELECT value FROM meta WHERE key = ?').get(SYNC_INTERVAL_KEY) as any;
            const intervalStr = intervalSetting?.value || 'off';

            if (intervalStr === 'off') return;

            const intervalMs = parseInterval(intervalStr);
            if (!intervalMs) return;

            const lastSyncSetting = db.prepare('SELECT value FROM meta WHERE key = ?').get(LAST_SYNC_KEY) as any;
            const lastSync = lastSyncSetting ? parseInt(lastSyncSetting.value, 10) : 0;
            const now = Date.now();

            if (now - lastSync >= intervalMs) {
                fastify.log.info(`Background sync triggered (interval: ${intervalStr})...`);

                // Get all feed URLs
                const feeds = db.prepare('SELECT url FROM feeds').all() as any[];
                const urls = feeds.map(f => f.url);

                if (urls.length === 0) return;

                // Update last sync time BEFORE starting to prevent concurrent triggers if it takes long
                db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                    .run(LAST_SYNC_KEY, now.toString());

                const limit = pLimit(MAX_CONCURRENCY);
                await Promise.all(
                    urls.map((url: string) => limit(() => fetchFeed(url, false)))
                );

                fastify.log.info('Background sync completed');
            }
        } catch (error: any) {
            fastify.log.error(error, 'Background sync error');
        }
    }, 60 * 1000);
}

function createJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function cleanupOldJobs() {
    if (refreshJobs.size > MAX_JOBS) {
        const sorted = Array.from(refreshJobs.entries())
            .sort((a, b) => a[1].startedAt - b[1].startedAt);
        const toDelete = sorted.slice(0, sorted.length - MAX_JOBS);
        toDelete.forEach(([id]) => refreshJobs.delete(id));
    }
}

// Initialize Fastify
const fastify = Fastify({
    logger: true
});

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Helper: Check if a column exists in a table
function columnExists(tableName: string, columnName: string): boolean {
    const result = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    return result.some((col: any) => col.name === columnName);
}

// Create schema on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feeds (
    url TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT,
    site_url TEXT,
    etag TEXT,
    last_modified TEXT,
    last_checked TEXT,
    last_status INTEGER,
    last_error TEXT,
    icon_url TEXT
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    feed_url TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT,
    url TEXT,
    author TEXT,
    summary TEXT,
    content TEXT,
    published TEXT,
    updated TEXT,
    media_thumbnail TEXT,
    media_duration_seconds INTEGER,
    external_id TEXT,
    raw_guid TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_items_feed_published 
    ON items(feed_url, published);
  
  CREATE INDEX IF NOT EXISTS idx_items_source_published 
    ON items(source, published);
`);

// Safe migration: Add is_read column if it doesn't exist
if (!columnExists('items', 'is_read')) {
    fastify.log.info('Adding is_read column to items table...');
    db.exec(`ALTER TABLE items ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0`);
    fastify.log.info('is_read column added successfully');
}

// Create index on is_read (safe to run multiple times)
db.exec(`CREATE INDEX IF NOT EXISTS idx_items_is_read ON items(is_read)`);

// Safe migration: Add is_starred column if it doesn't exist
if (!columnExists('items', 'is_starred')) {
    fastify.log.info('Adding is_starred column to items table...');
    db.exec(`ALTER TABLE items ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0`);
    fastify.log.info('is_starred column added successfully');
}

// Create index on is_starred (safe to run multiple times)
db.exec(`CREATE INDEX IF NOT EXISTS idx_items_is_starred ON items(is_starred)`);

// Migration: Normalize existing published/updated dates to ISO strings for correct sorting
db.exec(`
    CREATE TABLE IF NOT EXISTS _migration_status (
        name TEXT PRIMARY KEY,
        completed_at TEXT NOT NULL
    )
`);

const migrationCheck = db.prepare('SELECT completed_at FROM _migration_status WHERE name = ?').get('normalize_dates');
if (!migrationCheck) {
    fastify.log.info('Running date normalization migration...');
    const items = db.prepare('SELECT id, published, updated FROM items').all() as any[];
    const updateStmt = db.prepare('UPDATE items SET published = ?, updated = ? WHERE id = ?');

    let updatedCount = 0;
    db.transaction(() => {
        for (const item of items) {
            let pub = item.published;
            let upd = item.updated;

            try {
                if (pub) pub = new Date(pub).toISOString();
            } catch (e) { /* ignore */ }

            try {
                if (upd) upd = new Date(upd).toISOString();
            } catch (e) { /* ignore */ }

            if (pub !== item.published || upd !== item.updated) {
                updateStmt.run(pub, upd, item.id);
                updatedCount++;
            }
        }
    })();

    db.prepare('INSERT INTO _migration_status (name, completed_at) VALUES (?, ?)').run('normalize_dates', new Date().toISOString());
    fastify.log.info(`Date normalization migration complete. Updated ${updatedCount} items.`);
}

// Safe migration: Add icon_url column to feeds table if it doesn't exist
if (!columnExists('feeds', 'icon_url')) {
    fastify.log.info('Adding icon_url column to feeds table...');
    db.exec(`ALTER TABLE feeds ADD COLUMN icon_url TEXT`);
    fastify.log.info('icon_url column added successfully');
}

// Safe migration: Add custom_title column to feeds table if it doesn't exist
if (!columnExists('feeds', 'custom_title')) {
    fastify.log.info('Adding custom_title column to feeds table...');
    db.exec(`ALTER TABLE feeds ADD COLUMN custom_title TEXT`);
    fastify.log.info('custom_title column added successfully');
}

// Safe migration: Add playback_position column to items table if it doesn't exist
if (!columnExists('items', 'playback_position')) {
    fastify.log.info('Adding playback_position column to items table...');
    db.exec(`ALTER TABLE items ADD COLUMN playback_position REAL DEFAULT 0`);
    fastify.log.info('playback_position column added successfully');
}

// FTS5 setup: Check if FTS5 is available
try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_test USING fts5(test)`);
    db.exec(`DROP TABLE _fts5_test`);
    fastify.log.info('FTS5 is available');
} catch (error: any) {
    fastify.log.error('FTS5 is not available in this SQLite build');
    throw new Error('FTS5 extension is required but not available. Please use a SQLite build with FTS5 support.');
}

// Check if FTS5 virtual table exists
const ftsTableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='items_fts'
`).get();

if (!ftsTableExists) {
    fastify.log.info('Creating FTS5 virtual table for full-text search...');

    // Create FTS5 virtual table
    db.exec(`
        CREATE VIRTUAL TABLE items_fts USING fts5(
            title,
            summary,
            content,
            content=items,
            content_rowid=rowid
        )
    `);

    // Create triggers to keep FTS in sync
    db.exec(`
        CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
            INSERT INTO items_fts(rowid, title, summary, content)
            VALUES (new.rowid, new.title, new.summary, new.content);
        END;
    `);

    db.exec(`
        CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
            DELETE FROM items_fts WHERE rowid = old.rowid;
        END;
    `);

    db.exec(`
        CREATE TRIGGER items_au AFTER UPDATE OF title, summary, content ON items BEGIN
            UPDATE items_fts 
            SET title = new.title, summary = new.summary, content = new.content
            WHERE rowid = new.rowid;
        END;
    `);

    // Populate initial FTS index from existing items
    const itemCount = db.prepare('SELECT COUNT(*) as count FROM items').get() as any;
    if (itemCount.count > 0) {
        fastify.log.info(`Populating FTS index with ${itemCount.count} existing items...`);
        db.exec(`
            INSERT INTO items_fts(rowid, title, summary, content)
            SELECT rowid, title, summary, content FROM items
        `);
    }

    fastify.log.info('FTS5 setup complete');
}

// Safe migration: Add retry_count column if it doesn't exist
if (!columnExists('feeds', 'retry_count')) {
    fastify.log.info('Adding retry_count column to feeds table...');
    db.exec(`ALTER TABLE feeds ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`);
    fastify.log.info('retry_count column added successfully');
}

// Safe migration: Add next_retry_after column if it doesn't exist
if (!columnExists('feeds', 'next_retry_after')) {
    fastify.log.info('Adding next_retry_after column to feeds table...');
    db.exec(`ALTER TABLE feeds ADD COLUMN next_retry_after TEXT`);
    fastify.log.info('next_retry_after column added successfully');
}

// Reader cache table for storing extracted article content
db.exec(`
    CREATE TABLE IF NOT EXISTS reader_cache (
        url TEXT PRIMARY KEY,
        title TEXT,
        byline TEXT,
        excerpt TEXT,
        site_name TEXT,
        image_url TEXT,
        content_html TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reader_cache_updated ON reader_cache(updated_at);
`);

// Custom folders table for user-defined organization
db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
    );
`);

// Folder-feed associations (many-to-many)
db.exec(`
    CREATE TABLE IF NOT EXISTS folder_feeds (
        folder_id TEXT NOT NULL,
        feed_url TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(folder_id, feed_url),
        FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY(feed_url) REFERENCES feeds(url) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_folder_feeds_feed_url ON folder_feeds(feed_url);
    CREATE INDEX IF NOT EXISTS idx_folder_feeds_folder_id ON folder_feeds(folder_id);
`);

fastify.log.info(`Database initialized at ${DB_PATH}`);

// Prepare statements
const upsertHealthCheck = db.prepare(`
  INSERT INTO meta (key, value) 
  VALUES ('last_healthcheck', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const getFeed = db.prepare(`
  SELECT url, kind, etag, last_modified FROM feeds WHERE url = ?
`);

const upsertFeed = db.prepare(`
  INSERT INTO feeds (url, kind, title, site_url, etag, last_modified, last_checked, last_status, last_error, icon_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(url) DO UPDATE SET
    kind = excluded.kind,
    title = COALESCE(feeds.custom_title, excluded.title),
    site_url = excluded.site_url,
    etag = excluded.etag,
    last_modified = excluded.last_modified,
    last_checked = excluded.last_checked,
    last_status = excluded.last_status,
    last_error = excluded.last_error,
    icon_url = COALESCE(excluded.icon_url, feeds.icon_url)
`);

const updateFeedChecked = db.prepare(`
  UPDATE feeds 
  SET last_checked = ?, last_status = ?
  WHERE url = ?
`);

const upsertItem = db.prepare(`
  INSERT INTO items (
    id, feed_url, source, title, url, author, summary, content, 
    published, updated, media_thumbnail, media_duration_seconds, 
    external_id, raw_guid, created_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    title = excluded.title,
    url = excluded.url,
    author = excluded.author,
    summary = excluded.summary,
    content = excluded.content,
    published = excluded.published,
    updated = excluded.updated,
    media_thumbnail = excluded.media_thumbnail,
    media_duration_seconds = excluded.media_duration_seconds,
    external_id = excluded.external_id,
    raw_guid = excluded.raw_guid
`);

const countItemsByFeed = db.prepare(`
  SELECT COUNT(*) as count FROM items WHERE feed_url = ?
`);

// Initialize parsers
const rssParser = new Parser({
    timeout: FETCH_TIMEOUT_MS,
    headers: {
        'User-Agent': 'FeedStreamPWA/1.0'
    },
    customFields: {
        feed: [
            ['itunes:image', 'itunesImage'],
            ['itunes:author', 'itunesAuthor'],
            ['itunes:summary', 'itunesSummary'],
            ['itunes:category', 'itunesCategory']
        ],
        item: [
            ['media:thumbnail', 'mediaThumbnail'],
            ['media:content', 'mediaContent'],
            ['media:group', 'mediaGroup'],
            ['yt:videoId', 'ytVideoId'],
            ['yt:channelId', 'ytChannelId'],
            ['itunes:image', 'itunesImage'],
            ['itunes:duration', 'itunesDuration'],
            ['itunes:episode', 'itunesEpisode'],
            ['itunes:season', 'itunesSeason']
        ]
    }
} as any);

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
});

// Helper: Detect feed kind from URL
// Helper: Fetch icon for a feed
async function fetchFeedIcon(feedUrl: string, kind: string, siteUrl?: string | null, feedData?: any): Promise<string | null> {
    try {
        if (kind === 'youtube') {
            // Extract channel ID from feed URL
            let channelId = feedUrl.split('channel_id=')[1]?.split('&')[0];

            // If not in URL, try to find in feed data (Atom format)
            if (!channelId && feedData?.items?.length > 0) {
                const item = feedData.items[0];
                channelId = item.ytChannelId;
            }

            if (channelId) {
                try {
                    const response = await fetch(`https://www.youtube.com/channel/${channelId}`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });
                    if (response.ok) {
                        const html = await response.text();

                        // Try multiple patterns for avatar
                        const avatarPatterns = [
                            /"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/,
                            /"channelMetadataRenderer".*?"avatar".*?"url":"([^"]+)"/,
                            /yt-img-shadow.*?src="(https:\/\/yt3\.googleusercontent.com\/[^"]+)"/,
                            /<meta property="og:image" content="([^"]+)"/
                        ];

                        for (const pattern of avatarPatterns) {
                            const match = html.match(pattern);
                            if (match) {
                                let avatarUrl = match[1].replace(/\\u0026/g, '&');
                                // Force a reasonable resolution (s176 is standard high-res avatar)
                                if (avatarUrl.includes('=s')) {
                                    avatarUrl = avatarUrl.replace(/=s\d+.*/, '=s176-c-k-c0x00ffffff-no-rj-mo');
                                }
                                return avatarUrl;
                            }
                        }
                    }
                } catch (e) {
                    fastify.log.error(`Failed to scrape YT avatar for ${channelId}: ${e}`);
                }
            }
        } else if (kind === 'reddit') {
            const match = feedUrl.match(/reddit\.com\/r\/([^/?#.]+)/);
            if (match) {
                const subreddit = match[1];
                try {
                    const response = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`);
                    if (response.ok) {
                        const json = (await response.json()) as any;
                        const icon = json.data?.community_icon || json.data?.icon_img;
                        if (icon) return icon.replace(/&amp;/g, '&');
                    }
                } catch (e) {
                    fastify.log.error(`Failed to fetch Reddit icon for ${subreddit}: ${e}`);
                }
            }
        } else if (kind === 'podcast') {
            // Extract podcast artwork from feed data
            if (feedData) {
                const itunesImage = feedData.itunesImage;
                if (typeof itunesImage === 'object' && itunesImage['@_href']) return itunesImage['@_href'];
                if (typeof itunesImage === 'string') return itunesImage;

                if (feedData.image?.url) return feedData.image.url;
            }
        }

        // Generic fallback or RSS
        const domainSource = siteUrl || feedUrl;
        try {
            const url = new URL(domainSource);
            return `https://www.google.com/s2/favicons?sz=128&domain=${url.hostname}`;
        } catch {
            return null;
        }
    } catch (e) {
        console.error(`Failed to fetch icon for ${feedUrl}:`, e);
    }
    return null;
}

function detectFeedKind(url: string): 'youtube' | 'reddit' | 'podcast' | 'generic' {
    const lower = url.toLowerCase();

    // YouTube detection
    if (lower.includes('youtube.com') ||
        lower.includes('youtu.be') ||
        lower.includes('feeds/videos.xml')) {
        return 'youtube';
    }

    // Reddit detection
    if (lower.includes('reddit.com') ||
        lower.includes('/.rss') ||
        lower.includes('/r/')) {
        return 'reddit';
    }

    // Podcast detection
    if (lower.includes('podcast') ||
        lower.includes('.mp3') ||
        lower.includes('itunes.apple.com') ||
        lower.includes('anchor.fm')) {
        return 'podcast';
    }

    return 'generic';
}

// Helper: Extract YouTube metadata from parsed item
function extractYouTubeMetadata(item: any, rawXml?: any): any {
    const metadata: any = {
        external_id: null,
        media_thumbnail: null,
        media_duration_seconds: null
    };

    // Try to get videoId from custom fields
    if (item.ytVideoId) {
        metadata.external_id = item.ytVideoId;
    }

    // Try to extract thumbnail
    if (item.mediaThumbnail) {
        if (typeof item.mediaThumbnail === 'string') {
            metadata.media_thumbnail = item.mediaThumbnail;
        } else if (item.mediaThumbnail.url) {
            metadata.media_thumbnail = item.mediaThumbnail.url;
        } else if (item.mediaThumbnail['@_url']) {
            metadata.media_thumbnail = item.mediaThumbnail['@_url'];
        }
    }

    // Try media:group for thumbnail
    if (!metadata.media_thumbnail && item.mediaGroup) {
        const group = item.mediaGroup;
        const thumbnail = group['media:thumbnail'];
        if (thumbnail) {
            if (Array.isArray(thumbnail)) {
                metadata.media_thumbnail = thumbnail[0]?.['@_url'] || thumbnail[0]?.url;
            } else {
                metadata.media_thumbnail = thumbnail['@_url'] || thumbnail.url;
            }
        }
    }

    return metadata;
}

// Helper: Extract Reddit metadata
function extractRedditMetadata(item: any): any {
    const metadata: any = {
        external_id: null,
        media_thumbnail: null
    };

    // Try to extract thumbnail from content
    if (item.content) {
        const imgMatch = item.content.match(/<img[^>]+src="([^"]+)"/i);
        if (imgMatch) {
            metadata.media_thumbnail = imgMatch[1];
        }
    }

    return metadata;
}

// Helper: Generate stable ID for an item
function generateItemId(feedUrl: string, item: any, index: number, externalId?: string): string {
    const guid = externalId || item.guid || item.id || item.link || item.title || item.pubDate || index.toString();
    const input = `${feedUrl}|${guid}`;
    return createHash('sha256').update(input).digest('hex');
}

// Helper: Normalize parsed item
function normalizeItem(item: any, kind: 'youtube' | 'reddit' | 'podcast' | 'generic'): any {
    const rawPublished = item.pubDate || item.isoDate || item.date_published || null;
    const rawUpdated = item.updated || item.date_modified || null;

    let published = null;
    let updated = null;

    try {
        if (rawPublished) published = new Date(rawPublished).toISOString();
    } catch (e) {
        console.warn(`Failed to parse published date: ${rawPublished}`, e);
        published = rawPublished; // Fallback
    }

    try {
        if (rawUpdated) updated = new Date(rawUpdated).toISOString();
    } catch (e) {
        updated = rawUpdated; // Fallback
    }

    const normalized: any = {
        title: item.title || null,
        url: item.link || item.url || null,
        author: item.creator || item.author || null,
        summary: item.contentSnippet || item.summary || null,
        content: item.content || item['content:encoded'] || null,
        published,
        updated,
        raw_guid: item.guid || item.id || null,
        source: kind,
        media_thumbnail: item.mediaThumbnail || null,
        media_duration_seconds: null,
        external_id: null
    };

    // Apply kind-specific metadata extraction
    if (kind === 'youtube') {
        const ytMeta = extractYouTubeMetadata(item);
        Object.assign(normalized, ytMeta);
    } else if (kind === 'reddit') {
        const redditMeta = extractRedditMetadata(item);
        Object.assign(normalized, redditMeta);
    }

    return normalized;
}

// Helper: Fetch and parse a single feed
async function fetchFeed(url: string, force: boolean): Promise<any> {
    const feedRecord = getFeed.get(url) as any;
    let kind = feedRecord?.kind || detectFeedKind(url);

    // Allow upgrading 'generic' feeds if new patterns match
    if (kind === 'generic') {
        const upgradedKind = detectFeedKind(url);
        if (upgradedKind !== 'generic') kind = upgradedKind;
    }

    // Check if feed is in backoff period
    if (!force && feedRecord?.next_retry_after) {
        const now = new Date();
        const retryAfter = new Date(feedRecord.next_retry_after);

        if (now < retryAfter) {
            fastify.log.debug(`Skipping ${url} - in backoff until ${feedRecord.next_retry_after}`);
            return {
                url,
                kind,
                status: 0,
                title: feedRecord?.title || null,
                newItems: 0,
                totalItemsParsed: 0,
                totalItemsStored: (countItemsByFeed.get(url) as any)?.count || 0,
                error: 'In backoff period',
                skipped: true
            };
        }
    }

    const headers: Record<string, string> = {
        'User-Agent': 'FeedStreamPWA/1.0'
    };

    // Add conditional request headers if available
    if (!force && feedRecord) {
        if (feedRecord.etag) {
            headers['If-None-Match'] = feedRecord.etag;
        }
        if (feedRecord.last_modified) {
            headers['If-Modified-Since'] = feedRecord.last_modified;
        }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            headers,
            signal: controller.signal
        });

        clearTimeout(timeout);
        const now = new Date().toISOString();

        // Handle 304 Not Modified - success, reset retry
        if (response.status === 304) {
            updateFeedChecked.run(now, 304, url);
            db.prepare(`
                UPDATE feeds 
                SET retry_count = 0, next_retry_after = NULL 
                WHERE url = ?
            `).run(url);

            const itemCount = (countItemsByFeed.get(url) as any)?.count || 0;
            return {
                url,
                kind,
                status: 304,
                title: feedRecord?.title || null,
                newItems: 0,
                totalItemsParsed: 0,
                totalItemsStored: itemCount,
                error: null
            };
        }

        // Handle non-200 responses as failures
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Parse the feed
        const text = await response.text();
        const feed = await rssParser.parseString(text);

        // Extract feed metadata
        let title = feed.title || null;
        if (kind === 'reddit' && title && !title.startsWith('r/')) {
            title = `r/${title}`;
        }
        const siteUrl = feed.link || null;
        const etag = response.headers.get('etag') || null;
        const lastModified = response.headers.get('last-modified') || null;

        // Fetch/Update icon if missing or periodically
        const icon_url = await fetchFeedIcon(url, kind, siteUrl, feed);

        // Count existing items before insert
        const beforeCount = (countItemsByFeed.get(url) as any)?.count || 0;

        // Update feed record - success, reset retry
        upsertFeed.run(url, kind, title, siteUrl, etag, lastModified, now, 200, null, icon_url);
        db.prepare(`
            UPDATE feeds 
            SET retry_count = 0, next_retry_after = NULL 
            WHERE url = ?
        `).run(url);

        // Process items
        const items = feed.items || [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const normalized = normalizeItem(item, kind);

            // Generate stable ID
            const idSource = normalized.external_id || normalized.raw_guid || normalized.url || normalized.title || `${url}-${i}`;
            const id = createHash('sha256').update(`${url}|${idSource}`).digest('hex');

            try {
                upsertItem.run(
                    id,
                    url,
                    kind,
                    normalized.title,
                    normalized.url,
                    normalized.author,
                    normalized.summary,
                    normalized.content,
                    normalized.published,
                    normalized.updated,
                    normalized.media_thumbnail,
                    normalized.media_duration_seconds,
                    normalized.external_id,
                    normalized.raw_guid,
                    now
                );
            } catch (err: any) {
                // Ignore duplicate key errors
                if (!err.message.includes('UNIQUE constraint')) {
                    fastify.log.error(`Error inserting item: ${err.message}`);
                }
            }
        }

        // Count items after insert
        const afterCount = (countItemsByFeed.get(url) as any)?.count || 0;
        const newItems = afterCount - beforeCount;

        return {
            url,
            kind,
            status: 200,
            title,
            newItems,
            totalItemsParsed: items.length,
            totalItemsStored: afterCount,
            error: null
        };
    } catch (error: any) {
        clearTimeout(timeout);

        const errorMessage = error.name === 'AbortError' ? 'Fetch timeout' : error.message;
        const now = new Date().toISOString();

        // Get current retry count
        const currentRetryCount = feedRecord?.retry_count || 0;
        const newRetryCount = currentRetryCount + 1;

        // Calculate exponential backoff: min(24h, 10min * 2^retry_count)
        const baseDelayMs = 10 * 60 * 1000; // 10 minutes
        const maxDelayMs = 24 * 60 * 60 * 1000; // 24 hours
        const delayMs = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, currentRetryCount));

        const nextRetryAfter = new Date(Date.now() + delayMs).toISOString();

        // Update feed with error and backoff
        db.prepare(`
            UPDATE feeds 
            SET last_checked = ?, 
                last_status = ?, 
                last_error = ?,
                retry_count = ?,
                next_retry_after = ?
            WHERE url = ?
        `).run(now, 0, errorMessage, newRetryCount, nextRetryAfter, url);

        fastify.log.warn(`Feed ${url} failed (retry ${newRetryCount}): ${errorMessage}. Next retry after ${nextRetryAfter}`);

        return {
            url,
            kind,
            status: 0,
            title: null,
            newItems: 0,
            totalItemsParsed: 0,
            totalItemsStored: 0,
            error: errorMessage
        };
    }
}

// Health check endpoint
fastify.get('/health', async (request, reply) => {
    const now = new Date().toISOString();

    try {
        upsertHealthCheck.run(now);

        return {
            ok: true,
            time: now
        };
    } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Start refresh job endpoint
fastify.post('/refresh/start', async (request, reply) => {
    const body = request.body as any;

    let urls: string[];
    const force = body?.force === true;

    // If no URLs provided, refresh all feeds from database
    if (!body || !body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
        const allFeeds = db.prepare('SELECT url FROM feeds').all() as any[];
        urls = allFeeds.map((f: any) => f.url);

        if (urls.length === 0) {
            reply.code(400);
            return {
                ok: false,
                error: 'No feeds to refresh'
            };
        }
    } else {
        urls = body.urls;
    }

    // Validate URL count
    if (urls.length > 50) {
        reply.code(400);
        return {
            ok: false,
            error: 'Maximum 50 URLs per request'
        };
    }

    // Create job
    const jobId = createJobId();
    const job: RefreshJob = {
        id: jobId,
        status: 'running',
        current: 0,
        total: urls.length,
        message: 'Starting refresh...',
        startedAt: Date.now()
    };

    refreshJobs.set(jobId, job);
    cleanupOldJobs();

    // Start async refresh
    (async () => {
        const limit = pLimit(MAX_CONCURRENCY);
        let completed = 0;

        try {
            await Promise.all(
                urls.map((url: string) => limit(async () => {
                    try {
                        await fetchFeed(url, force);
                    } catch (error: any) {
                        // Continue on individual feed errors
                        fastify.log.error(`Failed to fetch ${url}: ${error.message || error}`);
                    } finally {
                        completed++;
                        job.current = completed;
                        job.message = `Updating feeds...`;
                    }
                }))
            );

            job.status = 'done';
            job.message = 'Refresh complete';
        } catch (error: any) {
            job.status = 'error';
            job.message = error.message || 'Refresh failed';
            fastify.log.error('Refresh job error:', error);
        }
    })();

    return {
        ok: true,
        jobId
    };
});

// Get refresh status endpoint
fastify.get('/refresh/status', async (request, reply) => {
    const query = request.query as any;
    const jobId = query.jobId;

    if (!jobId || typeof jobId !== 'string') {
        reply.code(400);
        return {
            ok: false,
            error: 'Missing jobId parameter'
        };
    }

    const job = refreshJobs.get(jobId);

    if (!job) {
        reply.code(404);
        return {
            ok: false,
            error: 'Job not found'
        };
    }

    return {
        ok: true,
        status: job.status,
        current: job.current,
        total: job.total,
        message: job.message
    };
});

// Legacy refresh endpoint (kept for backwards compatibility)
fastify.post('/refresh', async (request, reply) => {
    const body = request.body as any;

    let urls: string[];
    const force = body?.force === true;

    // If no URLs provided, refresh all feeds from database
    if (!body || !body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
        const allFeeds = db.prepare('SELECT url FROM feeds').all() as any[];
        urls = allFeeds.map((f: any) => f.url);

        if (urls.length === 0) {
            return {
                ok: true,
                results: [],
                message: 'No feeds to refresh'
            };
        }
    } else {
        urls = body.urls;
    }

    // Validate URL count
    if (urls.length > 50) {
        reply.code(400);
        return {
            ok: false,
            error: 'Maximum 50 URLs per request'
        };
    }

    // Validate each URL
    for (const url of urls) {
        if (typeof url !== 'string' || !url.match(/^https?:\/\/.+/)) {
            reply.code(400);
            return {
                ok: false,
                error: `Invalid URL: ${url}`
            };
        }
    }

    // Fetch feeds with concurrency limit
    const limit = pLimit(MAX_CONCURRENCY);
    const results = await Promise.all(
        urls.map((url: string) => limit(() => fetchFeed(url, force)))
    );

    return {
        ok: true,
        results
    };
});

// Folder management endpoints

// Get all custom folders with feed counts
fastify.get('/folders', async (request, reply) => {
    try {
        const folders = db.prepare(`
            SELECT 
                f.id,
                f.name,
                f.created_at,
                COUNT(ff.feed_url) as feedCount
            FROM folders f
            LEFT JOIN folder_feeds ff ON f.id = ff.folder_id
            GROUP BY f.id
            ORDER BY f.name ASC
        `).all();

        return {
            ok: true,
            folders
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Create a new custom folder
fastify.post('/folders', async (request, reply) => {
    const body = request.body as any;
    const name = body?.name?.trim();

    if (!name || name.length < 1 || name.length > 60) {
        reply.code(400);
        return {
            ok: false,
            error: 'Folder name must be between 1 and 60 characters'
        };
    }

    try {
        const id = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const created_at = new Date().toISOString();

        db.prepare(`
            INSERT INTO folders (id, name, created_at)
            VALUES (?, ?, ?)
        `).run(id, name, created_at);

        return {
            ok: true,
            folder: { id, name, created_at }
        };
    } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint')) {
            reply.code(409);
            return {
                ok: false,
                error: 'A folder with this name already exists'
            };
        }
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Rename a custom folder
fastify.patch('/folders/:id', async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const name = body?.name?.trim();

    if (!name || name.length < 1 || name.length > 60) {
        reply.code(400);
        return {
            ok: false,
            error: 'Folder name must be between 1 and 60 characters'
        };
    }

    try {
        const result = db.prepare(`
            UPDATE folders SET name = ? WHERE id = ?
        `).run(name, id);

        if (result.changes === 0) {
            reply.code(404);
            return {
                ok: false,
                error: 'Folder not found'
            };
        }

        return { ok: true };
    } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint')) {
            reply.code(409);
            return {
                ok: false,
                error: 'A folder with this name already exists'
            };
        }
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Delete a custom folder
fastify.delete('/folders/:id', async (request, reply) => {
    const { id } = request.params as any;

    try {
        // Count associations before deletion
        const associations = db.prepare(`
            SELECT COUNT(*) as count FROM folder_feeds WHERE folder_id = ?
        `).get(id) as any;

        // Delete folder (CASCADE will delete associations)
        const result = db.prepare(`
            DELETE FROM folders WHERE id = ?
        `).run(id);

        if (result.changes === 0) {
            reply.code(404);
            return {
                ok: false,
                error: 'Folder not found'
            };
        }

        return {
            ok: true,
            removedAssociations: associations.count
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Add feed to custom folder
fastify.post('/folders/:id/feeds', async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const feedUrl = body?.feedUrl;

    if (!feedUrl || typeof feedUrl !== 'string') {
        reply.code(400);
        return {
            ok: false,
            error: 'feedUrl is required'
        };
    }

    try {
        // Verify folder exists
        const folder = db.prepare('SELECT id FROM folders WHERE id = ?').get(id);
        if (!folder) {
            reply.code(404);
            return {
                ok: false,
                error: 'Folder not found'
            };
        }

        // Verify feed exists
        const feed = db.prepare('SELECT url FROM feeds WHERE url = ?').get(feedUrl);
        if (!feed) {
            reply.code(404);
            return {
                ok: false,
                error: 'Feed not found'
            };
        }

        // Insert association (ignore if exists)
        const created_at = new Date().toISOString();
        db.prepare(`
            INSERT OR IGNORE INTO folder_feeds (folder_id, feed_url, created_at)
            VALUES (?, ?, ?)
        `).run(id, feedUrl, created_at);

        return { ok: true };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Remove feed from custom folder
fastify.delete('/folders/:id/feeds', async (request, reply) => {
    const { id } = request.params as any;
    const body = request.body as any;
    const feedUrl = body?.feedUrl;

    if (!feedUrl || typeof feedUrl !== 'string') {
        reply.code(400);
        return {
            ok: false,
            error: 'feedUrl is required'
        };
    }

    try {
        const result = db.prepare(`
            DELETE FROM folder_feeds WHERE folder_id = ? AND feed_url = ?
        `).run(id, feedUrl);

        return {
            ok: true,
            removed: result.changes
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Get feeds endpoint
fastify.get('/feeds', async (request, reply) => {
    try {
        const feedsData = db.prepare(`
            SELECT 
                f.url,
                f.kind,
                f.title,
                f.site_url,
                f.last_checked,
                f.last_status,
                f.last_error,
                f.icon_url,
                f.custom_title,
                COUNT(CASE WHEN i.is_read = 0 THEN 1 END) as unreadCount
            FROM feeds f
            LEFT JOIN items i ON f.url = i.feed_url
            GROUP BY f.url
            ORDER BY f.title ASC
        `).all() as any[];

        // Get all folder associations for these feeds
        const feedUrls = feedsData.map((f: any) => f.url);
        const associations = feedUrls.length > 0
            ? db.prepare(`
                SELECT feed_url, folder_id
                FROM folder_feeds
                WHERE feed_url IN (${feedUrls.map(() => '?').join(',')})
            `).all(...feedUrls) as any[]
            : [];

        // Map associations by feed_url
        const foldersByFeed = new Map<string, string[]>();
        for (const assoc of associations) {
            if (!foldersByFeed.has(assoc.feed_url)) {
                foldersByFeed.set(assoc.feed_url, []);
            }
            foldersByFeed.get(assoc.feed_url)!.push(assoc.folder_id);
        }

        // Enhance feeds with smartFolder and folders
        const enhancedFeeds = feedsData.map((feed: any) => {
            // Derive smartFolder from kind
            let smartFolder: 'rss' | 'youtube' | 'reddit' = 'rss';
            if (feed.kind === 'youtube') {
                smartFolder = 'youtube';
            } else if (feed.kind === 'reddit') {
                smartFolder = 'reddit';
            }

            return {
                ...feed,
                smartFolder,
                folders: foldersByFeed.get(feed.url) || []
            };
        });

        return {
            ok: true,
            feeds: enhancedFeeds
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Feed search endpoint
fastify.get('/feeds/search', async (request, reply) => {
    const query = request.query as any;
    const searchQuery = query?.q?.trim();
    const searchType = query?.type || 'all';

    if (!searchQuery) {
        reply.code(400);
        return {
            ok: false,
            error: 'Missing search query parameter "q"'
        };
    }

    if (!['all', 'rss', 'youtube', 'reddit'].includes(searchType)) {
        reply.code(400);
        return {
            ok: false,
            error: 'Invalid type parameter. Must be one of: all, rss, youtube, reddit'
        };
    }

    try {
        const results = await searchFeeds(searchQuery, searchType as any);

        return {
            ok: true,
            results
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Search failed'
        };
    }
});

// Add feed endpoint
fastify.post('/feeds', async (request, reply) => {
    const body = request.body as any;

    if (!body || typeof body.url !== 'string') {
        reply.code(400);
        return {
            ok: false,
            error: 'Body must contain "url" string'
        };
    }

    let url = body.url.trim();
    const refresh = body.refresh === true;
    const folderIds = Array.isArray(body.folderIds) ? body.folderIds : [];

    // YouTube URL conversion: handle/channel to RSS
    let extractedTitle: string | null = null;
    if (url.includes('youtube.com/')) {
        // Handle @usernames
        const handleMatch = url.match(/youtube\.com\/(@[a-zA-Z0-9_-]+)/);
        if (handleMatch) {
            try {
                const response = await fetch(`https://www.youtube.com/${handleMatch[1]}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                if (response.ok) {
                    const text = await response.text();
                    const channelIdMatch = text.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
                    if (channelIdMatch) {
                        url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelIdMatch[1]}`;
                    }

                    // Try to extract channel name
                    const titleMatch = text.match(/<title>([^<]+) - YouTube<\/title>/i) || text.match(/"title":"([^"]+)"/);
                    if (titleMatch) {
                        extractedTitle = titleMatch[1];
                    }
                }
            } catch (e) {
                fastify.log.error(`Failed to convert YT handle: ${e}`);
            }
        }
        // Handle /c/ or /channel/ or /user/
        else if (url.includes('/channel/')) {
            const id = url.split('/channel/')[1]?.split('/')[0]?.split('?')[0];
            if (id) {
                url = `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
                try {
                    const response = await fetch(`https://www.youtube.com/channel/${id}`, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });
                    if (response.ok) {
                        const text = await response.text();
                        const titleMatch = text.match(/<title>([^<]+) - YouTube<\/title>/i) || text.match(/"title":"([^"]+)"/);
                        if (titleMatch) extractedTitle = titleMatch[1];
                    }
                } catch (e) { }
            }
        }
    }

    // Reddit auto-conversion
    if (url.includes('reddit.com/r/') && !url.includes('.rss') && !url.includes('.json')) {
        url = url.replace(/\/$/, '') + '.rss';
    }

    // Validate URL
    if (!url.match(/^https?:\/\/.+/)) {
        reply.code(400);
        return {
            ok: false,
            error: 'Invalid URL format'
        };
    }

    try {
        // Detect feed kind and fetch initial icon
        const kind = detectFeedKind(url);
        const icon_url = await fetchFeedIcon(url, kind);

        // Insert feed if not exists
        const stmt = db.prepare(`
            INSERT INTO feeds (url, kind, title, site_url, etag, last_modified, last_checked, last_status, last_error, icon_url)
            VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)
            ON CONFLICT(url) DO UPDATE SET 
                title = CASE WHEN excluded.title IS NOT NULL THEN excluded.title ELSE feeds.title END,
                icon_url = excluded.icon_url
        `);
        stmt.run(url, kind, extractedTitle, icon_url);

        // Add to custom folders if provided
        if (folderIds.length > 0) {
            const created_at = new Date().toISOString();
            const insertAssoc = db.prepare(`
                INSERT OR IGNORE INTO folder_feeds (folder_id, feed_url, created_at)
                VALUES (?, ?, ?)
            `);

            for (const folderId of folderIds) {
                // Verify folder exists
                const folderExists = db.prepare('SELECT id FROM folders WHERE id = ?').get(folderId);
                if (folderExists) {
                    insertAssoc.run(folderId, url, created_at);
                }
            }
        }

        // Optionally refresh the feed
        let refreshResult = null;
        if (refresh) {
            refreshResult = await fetchFeed(url, false);
        }

        return {
            ok: true,
            refreshResult
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Rename feed endpoint
fastify.patch('/feeds', async (request, reply) => {
    const body = request.body as any;
    const url = body?.url;
    const title = body?.title?.trim();

    if (!url || typeof url !== 'string') {
        reply.code(400);
        return { ok: false, error: 'url is required' };
    }

    if (title === undefined) {
        reply.code(400);
        return { ok: false, error: 'title is required' };
    }

    try {
        const result = db.prepare(`
            UPDATE feeds SET custom_title = ?, title = COALESCE(?, title) WHERE url = ?
        `).run(title || null, title || null, url);

        if (result.changes === 0) {
            reply.code(404);
            return { ok: false, error: 'Feed not found' };
        }

        return { ok: true };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return { ok: false, error: 'Database error' };
    }
});

// Delete feed endpoint
fastify.delete('/feeds', async (request, reply) => {
    const query = request.query as any;
    const body = request.body as any;

    const url = query.url || body?.url;

    if (!url || typeof url !== 'string') {
        reply.code(400);
        return {
            ok: false,
            error: 'Must provide "url" parameter'
        };
    }

    try {
        // Delete items first (foreign key constraint)
        const deleteItems = db.prepare('DELETE FROM items WHERE feed_url = ?');
        deleteItems.run(url);

        // Delete feed
        const deleteFeed = db.prepare('DELETE FROM feeds WHERE url = ?');
        const result = deleteFeed.run(url);

        if (result.changes === 0) {
            reply.code(404);
            return {
                ok: false,
                error: 'Feed not found'
            };
        }

        return {
            ok: true
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Export feeds as OPML
fastify.get('/opml/export', async (request, reply) => {
    try {
        const allFeeds = db.prepare('SELECT url, title, site_url FROM feeds ORDER BY title, url').all() as any[];

        // Generate OPML XML
        const opmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
	<head>
		<title>FeedStream Subscriptions</title>
		<dateCreated>${new Date().toUTCString()}</dateCreated>
	</head>
	<body>`;

        const outlines = allFeeds.map(feed => {
            const text = feed.title || feed.url;
            const title = feed.title || feed.url;
            const xmlUrl = feed.url;
            const htmlUrl = feed.site_url || '';

            // Escape XML special characters
            const escapeXml = (str: string) => {
                return str
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
            };

            let outline = `\n		<outline text="${escapeXml(text)}" title="${escapeXml(title)}" type="rss" xmlUrl="${escapeXml(xmlUrl)}"`;
            if (htmlUrl) {
                outline += ` htmlUrl="${escapeXml(htmlUrl)}"`;
            }
            outline += '/>';
            return outline;
        }).join('');

        const opmlFooter = `\n	</body>
</opml>`;

        const opml = opmlHeader + outlines + opmlFooter;

        reply.header('Content-Type', 'application/xml');
        reply.header('Content-Disposition', `attachment; filename="feedstream-${Date.now()}.opml"`);
        return opml;
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Failed to generate OPML'
        };
    }
});

// Import feeds from OPML
fastify.post('/opml/import', async (request, reply) => {
    const body = request.body as any;

    if (!body || typeof body.opml !== 'string') {
        reply.code(400);
        return {
            ok: false,
            error: 'Body must contain "opml" string'
        };
    }

    try {
        // Parse OPML XML
        const parsed = xmlParser.parse(body.opml);

        if (!parsed.opml || !parsed.opml.body) {
            reply.code(400);
            return {
                ok: false,
                error: 'Invalid OPML: missing opml or body element'
            };
        }

        // Recursively extract all outline nodes with xmlUrl
        const extractOutlines = (node: any): any[] => {
            const results: any[] = [];

            if (!node) return results;

            // Handle single outline or array of outlines
            const outlines = Array.isArray(node.outline) ? node.outline : (node.outline ? [node.outline] : []);

            for (const outline of outlines) {
                // Check for xmlUrl attribute (with @ prefix from parser)
                const xmlUrl = outline['@_xmlUrl'] || outline.xmlUrl;

                if (xmlUrl) {
                    results.push({
                        xmlUrl,
                        title: outline['@_title'] || outline.title || outline['@_text'] || outline.text || null
                    });
                }

                // Recursively check nested outlines
                if (outline.outline) {
                    results.push(...extractOutlines(outline));
                }
            }

            return results;
        };

        const feedsToImport = extractOutlines(parsed.opml.body);

        if (feedsToImport.length === 0) {
            return {
                ok: true,
                added: 0,
                skipped: 0,
                failed: []
            };
        }

        // Get existing feed URLs
        const existingFeeds = db.prepare('SELECT url FROM feeds').all() as any[];
        const existingUrls = new Set(existingFeeds.map((f: any) => f.url));

        let added = 0;
        let skipped = 0;
        const failed: Array<{ url: string; error: string }> = [];

        // Process each feed concurrently with p-limit
        const limit = pLimit(MAX_CONCURRENCY);
        const importPromises = feedsToImport.map((feed: any) => limit(async () => {
            const url = feed.xmlUrl.trim();

            // Validate URL format
            if (!url.match(/^https?:\/\/.+/)) {
                failed.push({ url, error: 'Invalid URL format' });
                return;
            }

            // Skip if already exists (quick check)
            if (existingUrls.has(url)) {
                skipped++;
                return;
            }

            try {
                // Detect feed kind and fetch icon
                const kind = detectFeedKind(url);
                const icon_url = await fetchFeedIcon(url, kind);

                // Insert feed (reuse same logic as POST /feeds)
                const stmt = db.prepare(`
                    INSERT OR IGNORE INTO feeds (url, kind, title, site_url, etag, last_modified, last_checked, last_status, last_error, icon_url)
                    VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?)
                `);
                const result = stmt.run(url, kind, feed.title, icon_url);

                if (result.changes > 0) {
                    existingUrls.add(url);
                    added++;
                } else {
                    skipped++;
                }
            } catch (error: any) {
                failed.push({ url, error: error.message || 'Database error' });
            }
        }));

        await Promise.all(importPromises);

        return {
            ok: true,
            added,
            skipped,
            failed
        };
    } catch (error: any) {
        fastify.log.error(error);

        // Check if it's an XML parsing error
        if (error.message && error.message.includes('XML')) {
            reply.code(400);
            return {
                ok: false,
                error: 'Invalid XML: ' + error.message
            };
        }

        reply.code(500);
        return {
            ok: false,
            error: 'Failed to import OPML'
        };
    }
});


// Get items endpoint
fastify.get('/items', async (request, reply) => {
    const query = request.query as any;

    // Parse query parameters
    const feed = query.feed || null;
    const source = query.source || null;
    const smartFolder = query.smartFolder || null;
    const folderId = query.folderId || null;
    const unreadOnly = query.unreadOnly === 'true';
    const starredOnly = query.starredOnly === '1' || query.starredOnly === 'true';
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const offset = parseInt(query.offset || '0', 10);

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (feed) {
        conditions.push('i.feed_url = ?');
        params.push(feed);
    }

    if (source && ['generic', 'youtube', 'reddit', 'podcast'].includes(source)) {
        conditions.push('i.source = ?');
        params.push(source);
    }

    // Smart folder filter (by feed kind)
    if (smartFolder && ['rss', 'youtube', 'reddit', 'podcast'].includes(smartFolder)) {
        let kindValue = 'generic';
        if (smartFolder === 'youtube') kindValue = 'youtube';
        if (smartFolder === 'reddit') kindValue = 'reddit';
        if (smartFolder === 'podcast') kindValue = 'podcast';
        conditions.push('f.kind = ?');
        params.push(kindValue);
    }

    // Custom folder filter
    if (folderId) {
        conditions.push('i.feed_url IN (SELECT feed_url FROM folder_feeds WHERE folder_id = ?)');
        params.push(folderId);
    }

    if (unreadOnly) {
        conditions.push('i.is_read = 0');
    }

    if (starredOnly) {
        conditions.push('i.is_starred = 1');
    }

    // Need to join feeds table if filtering by smartFolder
    const fromClause = 'FROM items i INNER JOIN feeds f ON i.feed_url = f.url';
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
    const countResult = db.prepare(countQuery).get(...params) as any;
    const total = countResult.total;

    // Get items
    const itemsQuery = `
        SELECT 
            i.id, i.feed_url, i.source, i.title, i.url, i.author, i.summary, i.content,
            i.published, i.updated, i.media_thumbnail, i.media_duration_seconds,
            i.external_id, i.raw_guid, i.created_at, i.is_read, i.is_starred, i.playback_position,
            f.icon_url as feed_icon_url, COALESCE(f.custom_title, f.title) as feed_title
        ${fromClause}
        ${whereClause}
        ORDER BY 
            CASE WHEN i.published IS NOT NULL THEN i.published ELSE i.created_at END DESC
        LIMIT ? OFFSET ?
    `;

    const items = db.prepare(itemsQuery).all(...params, limit, offset);

    return {
        ok: true,
        total,
        items
    };
});

// Mark item as read/unread
fastify.post('/items/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (typeof body.read !== 'boolean') {
        reply.code(400);
        return {
            ok: false,
            error: 'Body must contain "read" boolean'
        };
    }

    const isRead = body.read ? 1 : 0;

    try {
        const stmt = db.prepare('UPDATE items SET is_read = ? WHERE id = ?');
        const result = stmt.run(isRead, id);

        if (result.changes === 0) {
            reply.code(404);
            return {
                ok: false,
                error: 'Item not found'
            };
        }

        return {
            ok: true
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Mark all items as read with optional filters
fastify.post('/items/mark-all-read', async (request, reply) => {
    const body = request.body as any;

    // Validate body is an object
    if (!body || typeof body !== 'object') {
        reply.code(400);
        return {
            ok: false,
            error: 'Request body must be a JSON object'
        };
    }

    const feedUrl = body.feedUrl || null;
    const source = body.source || null;
    const before = body.before || null;

    // Validate source if provided
    if (source && !['generic', 'youtube', 'reddit'].includes(source)) {
        reply.code(400);
        return {
            ok: false,
            error: 'Invalid source. Must be: generic, youtube, or reddit'
        };
    }

    try {
        // Build WHERE clause dynamically
        const conditions: string[] = ['is_read = 0'];
        const params: any[] = [];

        if (feedUrl) {
            conditions.push('feed_url = ?');
            params.push(feedUrl);
        }

        if (source) {
            conditions.push('source = ?');
            params.push(source);
        }

        if (before) {
            conditions.push('published <= ?');
            params.push(before);
        }

        const whereClause = conditions.join(' AND ');
        const query = `UPDATE items SET is_read = 1 WHERE ${whereClause}`;

        const stmt = db.prepare(query);
        const result = stmt.run(...params);

        return {
            ok: true,
            updated: result.changes
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Star/unstar item
fastify.post('/items/:id/star', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (typeof body.starred !== 'boolean') {
        reply.code(400);
        return {
            ok: false,
            error: 'Body must contain "starred" boolean'
        };
    }

    const isStarred = body.starred ? 1 : 0;

    try {
        const stmt = db.prepare('UPDATE items SET is_starred = ? WHERE id = ?');
        const result = stmt.run(isStarred, id);

        if (result.changes === 0) {
            reply.code(404);
            return {
                ok: false,
                error: 'Item not found'
            };
        }

        return {
            ok: true
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

fastify.patch('/items/:id/playback-position', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;

    if (body.position === undefined || typeof body.position !== 'number') {
        reply.code(400);
        return { ok: false, error: 'Missing or invalid "position" number' };
    }

    try {
        const result = db.prepare('UPDATE items SET playback_position = ? WHERE id = ?').run(body.position, id);
        if (result.changes === 0) {
            reply.code(404);
            return { ok: false, error: 'Item not found' };
        }
        return { ok: true, playback_position: body.position };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return { ok: false, error: 'Database error' };
    }
});

// Helper: Normalize and resolve absolute URLs
function normalizeUrl(url: string, baseUrl?: string): string {
    try {
        if (baseUrl) {
            return new URL(url, baseUrl).href;
        }
        return new URL(url).href;
    } catch {
        return url;
    }
}

// Helper: Check if URL is a usable image (not data URI, not tiny icon)
function isUsableImage(src: string): boolean {
    if (!src || src.startsWith('data:')) return false;
    const lower = src.toLowerCase();
    if (lower.includes('icon') || lower.includes('logo') || lower.includes('avatar')) return false;
    return true;
}

// Reader View endpoint with caching and sanitization
fastify.get('/reader', async (request, reply) => {
    const query = request.query as any;
    const targetUrl = query.url;

    if (!targetUrl || typeof targetUrl !== 'string') {
        reply.code(400);
        return {
            ok: false,
            error: 'Missing or invalid url parameter'
        };
    }

    // Validate URL is http/https
    try {
        const parsed = new URL(targetUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            reply.code(400);
            return { ok: false, error: 'Only http/https URLs are allowed' };
        }
    } catch {
        reply.code(400);
        return { ok: false, error: 'Invalid URL format' };
    }

    try {
        // Check cache first
        const cached = db.prepare(`
            SELECT url, title, byline, excerpt, site_name, image_url, content_html, created_at, updated_at
            FROM reader_cache WHERE url = ?
        `).get(targetUrl) as any;

        if (cached && isCacheFresh(cached.updated_at)) {
            return {
                ok: true,
                url: cached.url,
                title: cached.title,
                byline: cached.byline,
                excerpt: cached.excerpt,
                siteName: cached.site_name,
                imageUrl: cached.image_url,
                contentHtml: cached.content_html,
                fromCache: true
            };
        }

        // Special handling for YouTube videos
        if (targetUrl.includes('youtube.com/watch') || targetUrl.includes('youtu.be/')) {
            let videoId = null;
            if (targetUrl.includes('v=')) {
                videoId = targetUrl.split('v=')[1]?.split('&')[0];
            } else if (targetUrl.includes('youtu.be/')) {
                videoId = targetUrl.split('youtu.be/')[1]?.split('?')[0];
            }

            if (videoId) {
                const embedHtml = `
                    <div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; margin-bottom: 20px;">
                        <iframe 
                            src="https://www.youtube.com/embed/${videoId}?autoplay=1" 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>
                `;

                const result = {
                    ok: true,
                    url: targetUrl,
                    title: 'YouTube Video',
                    byline: null,
                    excerpt: null,
                    siteName: 'YouTube',
                    imageUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                    contentHtml: embedHtml,
                    fromCache: false
                };

                // Cache it
                const now = new Date().toISOString();
                db.prepare(`
                    INSERT INTO reader_cache (url, title, byline, excerpt, site_name, image_url, content_html, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(url) DO UPDATE SET
                        title = excluded.title,
                        content_html = excluded.content_html,
                        updated_at = excluded.updated_at
                `).run(targetUrl, result.title, null, null, 'YouTube', result.imageUrl, embedHtml, now, now);

                return result;
            }
        }

        // Fetch the page HTML
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': new URL(targetUrl).origin,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            },
            signal: controller.signal,
            redirect: 'follow'
        });

        clearTimeout(timeout);

        if (!response.ok) {
            fastify.log.warn(`Reader fetch failed for ${targetUrl}: ${response.status} ${response.statusText}`);
            reply.code(response.status);
            return {
                ok: false,
                error: `Failed to fetch: ${response.statusText || response.status}`
            };
        }

        const html = await response.text();
        const finalUrl = response.url || targetUrl;

        // Parse with JSDOM
        const dom = new JSDOM(html, { url: finalUrl });
        const document = dom.window.document;

        // Extract og:image BEFORE stripping junk (priority image source)
        let imageUrl: string | null = null;
        const ogImage = document.querySelector('meta[property="og:image"]');
        const twitterImage = document.querySelector('meta[name="twitter:image"]');
        if (ogImage) {
            const content = ogImage.getAttribute('content');
            if (content) imageUrl = normalizeUrl(content, finalUrl);
        } else if (twitterImage) {
            const content = twitterImage.getAttribute('content');
            if (content) imageUrl = normalizeUrl(content, finalUrl);
        }

        // Pre-strip only the most obvious common noise if absolutely necessary, 
        // but let Readability do most of the work to avoid stripping real content.
        const noiseSelectors = [
            'noscript', 'form', 'iframe', 'script', 'style'
        ];

        noiseSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach((el: Element) => el.remove());
        });

        // Run Readability
        const reader = new Readability(document);
        const article = reader.parse();

        if (!article || !article.content) {
            reply.code(422);
            return {
                ok: false,
                error: 'Could not extract readable content'
            };
        }

        // Parse the article content to extract first image (fallback if no og:image)
        const contentDom = new JSDOM(article.content);
        const contentDoc = contentDom.window.document;

        if (!imageUrl) {
            const images = contentDoc.querySelectorAll('img');
            for (const img of Array.from(images)) {
                const src = (img as HTMLImageElement).getAttribute('src');
                if (src && isUsableImage(src)) {
                    imageUrl = normalizeUrl(src, finalUrl);
                    break;
                }
            }
        }

        // Remove all headings from content (title is separate)
        contentDoc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el: Element) => el.remove());

        // Remove all images from content (hero image is separate)
        contentDoc.querySelectorAll('img').forEach((el: Element) => el.remove());

        // Get raw HTML before sanitizing
        const rawHtml = contentDoc.body.innerHTML;

        // Sanitize the final content
        const contentHtml = sanitizeHtml(rawHtml, sanitizeOptions);

        // Build structured response
        const result = {
            ok: true,
            url: finalUrl,
            title: article.title || null,
            byline: article.byline || null,
            excerpt: article.excerpt || null,
            siteName: article.siteName || null,
            imageUrl,
            contentHtml,
            fromCache: false
        };

        // Upsert into cache
        const now = new Date().toISOString();
        db.prepare(`
            INSERT INTO reader_cache (url, title, byline, excerpt, site_name, image_url, content_html, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(url) DO UPDATE SET
                title = excluded.title,
                byline = excluded.byline,
                excerpt = excluded.excerpt,
                site_name = excluded.site_name,
                image_url = excluded.image_url,
                content_html = excluded.content_html,
                updated_at = excluded.updated_at
        `).run(
            finalUrl,
            result.title,
            result.byline,
            result.excerpt,
            result.siteName,
            result.imageUrl,
            result.contentHtml,
            cached?.created_at || now,
            now
        );

        return result;
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: error.message || 'Internal server error'
        };
    }
});

// Purge old reader cache entries
fastify.post('/reader/purge', async (request, reply) => {
    const body = request.body as any || {};
    const olderThanHours = body.olderThanHours ?? 720; // 30 days default

    try {
        const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
        const result = db.prepare(`
            DELETE FROM reader_cache WHERE updated_at < ?
        `).run(cutoff);

        return {
            ok: true,
            deleted: result.changes
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: error.message || 'Internal server error'
        };
    }
});

// Search endpoint using FTS5
fastify.get('/search', async (request, reply) => {
    const query = request.query as any;

    const searchQuery = query.q || '';
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const offset = parseInt(query.offset || '0', 10);

    if (!searchQuery.trim()) {
        reply.code(400);
        return {
            ok: false,
            error: 'Query parameter "q" is required'
        };
    }

    try {
        // Get total count of matching items
        const countQuery = `
            SELECT COUNT(*) as total
            FROM items_fts
            WHERE items_fts MATCH ?
        `;
        const countResult = db.prepare(countQuery).get(searchQuery) as any;
        const total = countResult.total;

        // Get matching items with relevance ranking
        const searchSql = `
            SELECT 
                items.id,
                items.feed_url,
                items.source,
                items.title,
                items.url,
                items.author,
                items.summary,
                items.content,
                items.published,
                items.updated,
                items.media_thumbnail,
                items.media_duration_seconds,
                items.external_id,
                items.raw_guid,
                items.created_at,
                items.is_read,
                items.is_starred,
                bm25(items_fts) as rank
            FROM items_fts
            JOIN items ON items.rowid = items_fts.rowid
            WHERE items_fts MATCH ?
            ORDER BY rank
            LIMIT ? OFFSET ?
        `;

        const results = db.prepare(searchSql).all(searchQuery, limit, offset);

        return {
            ok: true,
            total,
            items: results
        };
    } catch (error: any) {
        fastify.log.error(error);

        // Check if it's an FTS syntax error
        if (error.message && error.message.includes('fts5')) {
            reply.code(400);
            return {
                ok: false,
                error: 'Invalid search query syntax'
            };
        }

        reply.code(500);
        return {
            ok: false,
            error: 'Search failed'
        };
    }
});

// Settings management endpoints
fastify.get('/settings', async (request, reply) => {
    try {
        const settings = db.prepare('SELECT key, value FROM meta').all() as any[];
        const config: Record<string, string> = {};
        settings.forEach(s => {
            config[s.key] = s.value;
        });

        // Ensure defaults
        if (!config[SYNC_INTERVAL_KEY]) config[SYNC_INTERVAL_KEY] = 'off';

        return {
            ok: true,
            settings: config
        };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return { ok: false, error: 'Database error' };
    }
});

fastify.patch('/settings', async (request, reply) => {
    const body = request.body as any;
    if (!body || typeof body !== 'object') {
        reply.code(400);
        return { ok: false, error: 'Invalid body' };
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO meta (key, value) 
            VALUES (?, ?) 
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);

        db.transaction(() => {
            for (const [key, value] of Object.entries(body)) {
                if (typeof value === 'string') {
                    stmt.run(key, value);
                }
            }
        })();

        return { ok: true };
    } catch (error: any) {
        fastify.log.error(error);
        reply.code(500);
        return { ok: false, error: 'Database error' };
    }
});
const start = async () => {
    try {
        // Register security middleware
        await fastify.register(helmet, {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        });

        await fastify.register(cors, {
            origin: true, // Allow all origins - configure for production if needed
            credentials: true,
        });

        await fastify.register(rateLimit, {
            max: 100, // 100 requests
            timeWindow: '1 minute', // per minute
            errorResponseBuilder: () => ({
                ok: false,
                error: 'Rate limit exceeded. Please try again later.',
                statusCode: 429,
            }),
        });

        fastify.log.info('Security middleware registered');

        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        fastify.log.info(`Server listening on http://0.0.0.0:${PORT}`);

        // Start background sync
        startBackgroundSync();
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    if (backgroundSyncTimer) {
        clearInterval(backgroundSyncTimer);
    }
    db.close();
    await fastify.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
