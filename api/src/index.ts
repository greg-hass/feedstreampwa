import Fastify from 'fastify';
import Database from 'better-sqlite3';
import Parser from 'rss-parser';
import pLimit from 'p-limit';
import { createHash } from 'crypto';
import { XMLParser } from 'fast-xml-parser';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DB_PATH = process.env.DB_PATH || '/data/feedstream.sqlite';
const FETCH_TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || '12000', 10);
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '6', 10);

// Initialize Fastify
const fastify = Fastify({
    logger: true
});

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

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
    last_error TEXT
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
  INSERT INTO feeds (url, kind, title, site_url, etag, last_modified, last_checked, last_status, last_error)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(url) DO UPDATE SET
    kind = excluded.kind,
    title = excluded.title,
    site_url = excluded.site_url,
    etag = excluded.etag,
    last_modified = excluded.last_modified,
    last_checked = excluded.last_checked,
    last_status = excluded.last_status,
    last_error = excluded.last_error
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
        item: [
            ['media:thumbnail', 'mediaThumbnail'],
            ['media:content', 'mediaContent'],
            ['media:group', 'mediaGroup'],
            ['yt:videoId', 'ytVideoId'],
            ['yt:channelId', 'ytChannelId']
        ]
    }
});

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
});

// Helper: Detect feed kind from URL
function detectFeedKind(url: string): 'youtube' | 'reddit' | 'generic' {
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
        if (group['media:thumbnail'] && group['media:thumbnail']['@_url']) {
            metadata.media_thumbnail = group['media:thumbnail']['@_url'];
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
function normalizeItem(item: any, kind: 'youtube' | 'reddit' | 'generic'): any {
    const normalized: any = {
        title: item.title || null,
        url: item.link || item.url || null,
        author: item.creator || item.author || null,
        summary: item.contentSnippet || item.summary || null,
        content: item.content || item['content:encoded'] || null,
        published: item.pubDate || item.isoDate || item.date_published || null,
        updated: item.updated || item.date_modified || null,
        raw_guid: item.guid || item.id || null,
        media_thumbnail: null,
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
    const now = new Date().toISOString();
    const kind = detectFeedKind(url);

    try {
        // Get cached feed metadata
        const cached = getFeed.get(url) as any;

        // Build fetch options with conditional GET headers
        const headers: Record<string, string> = {
            'User-Agent': 'FeedStreamPWA/1.0'
        };

        if (!force && cached) {
            if (cached.etag) {
                headers['If-None-Match'] = cached.etag;
            }
            if (cached.last_modified) {
                headers['If-Modified-Since'] = cached.last_modified;
            }
        }

        // Fetch the feed
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await fetch(url, {
            headers,
            signal: controller.signal
        });

        clearTimeout(timeout);

        // Handle 304 Not Modified
        if (response.status === 304) {
            updateFeedChecked.run(now, 304, url);
            const itemCount = (countItemsByFeed.get(url) as any)?.count || 0;

            return {
                url,
                kind,
                status: 304,
                title: cached?.title || null,
                newItems: 0,
                totalItemsParsed: 0,
                totalItemsStored: itemCount,
                error: null
            };
        }

        // Handle non-200 responses
        if (response.status !== 200) {
            const error = `HTTP ${response.status}: ${response.statusText}`;
            upsertFeed.run(url, kind, null, null, null, null, now, response.status, error);

            return {
                url,
                kind,
                status: response.status,
                title: null,
                newItems: 0,
                totalItemsParsed: 0,
                totalItemsStored: 0,
                error
            };
        }

        // Parse the feed
        const text = await response.text();
        let feedData: any;
        let siteUrl: string | null = null;

        // Try JSON Feed first
        if (response.headers.get('content-type')?.includes('json')) {
            try {
                const json = JSON.parse(text);
                if (json.version && json.items) {
                    // JSON Feed format
                    feedData = {
                        title: json.title,
                        items: json.items.map((item: any) => ({
                            title: item.title,
                            link: item.url,
                            content: item.content_html || item.content_text,
                            contentSnippet: item.summary,
                            pubDate: item.date_published,
                            updated: item.date_modified,
                            guid: item.id,
                            author: item.author?.name
                        }))
                    };
                    siteUrl = json.home_page_url || null;
                }
            } catch (e) {
                // Not JSON Feed, fall through to XML parsing
            }
        }

        // Parse as RSS/Atom if not JSON Feed
        if (!feedData) {
            feedData = await rssParser.parseString(text);
            siteUrl = feedData.link || null;
        }

        const feedTitle = feedData.title || null;
        const items = feedData.items || [];

        // Extract ETag and Last-Modified headers
        const etag = response.headers.get('etag') || null;
        const lastModified = response.headers.get('last-modified') || null;

        // Count existing items before insert
        const beforeCount = (countItemsByFeed.get(url) as any)?.count || 0;

        // Insert items in a transaction
        const insertItems = db.transaction((items: any[]) => {
            items.forEach((item, index) => {
                const normalized = normalizeItem(item, kind);
                const id = generateItemId(url, item, index, normalized.external_id);

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
            });
        });

        insertItems(items);

        // Update feed metadata
        upsertFeed.run(url, kind, feedTitle, siteUrl, etag, lastModified, now, 200, null);

        // Count items after insert
        const afterCount = (countItemsByFeed.get(url) as any)?.count || 0;
        const newItems = afterCount - beforeCount;

        return {
            url,
            kind,
            status: 200,
            title: feedTitle,
            newItems,
            totalItemsParsed: items.length,
            totalItemsStored: afterCount,
            error: null
        };

    } catch (error: any) {
        const errorMsg = error.message || 'Unknown error';
        upsertFeed.run(url, kind, null, null, null, null, now, 0, errorMsg);

        return {
            url,
            kind,
            status: 0,
            title: null,
            newItems: 0,
            totalItemsParsed: 0,
            totalItemsStored: 0,
            error: errorMsg
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

// Refresh feeds endpoint
fastify.post('/refresh', async (request, reply) => {
    const body = request.body as any;

    // Validate input
    if (!body || !Array.isArray(body.urls)) {
        reply.code(400);
        return {
            ok: false,
            error: 'Body must contain "urls" array'
        };
    }

    const urls = body.urls;
    const force = body.force === true;

    // Validate URL count
    if (urls.length < 1 || urls.length > 50) {
        reply.code(400);
        return {
            ok: false,
            error: 'Must provide 1-50 URLs'
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
        urls.map(url => limit(() => fetchFeed(url, force)))
    );

    return {
        ok: true,
        results
    };
});

// Start server
const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        fastify.log.info(`Server listening on http://0.0.0.0:${PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    db.close();
    await fastify.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
