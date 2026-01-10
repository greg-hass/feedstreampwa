import Fastify from 'fastify';
import Database from 'better-sqlite3';
import Parser from 'rss-parser';
import pLimit from 'p-limit';
import { createHash } from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

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
    const feedRecord = getFeed.get(url) as any;
    const kind = feedRecord?.kind || detectFeedKind(url);

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
        const title = feed.title || null;
        const siteUrl = feed.link || null;
        const etag = response.headers.get('etag') || null;
        const lastModified = response.headers.get('last-modified') || null;

        // Count existing items before insert
        const beforeCount = (countItemsByFeed.get(url) as any)?.count || 0;

        // Update feed record - success, reset retry
        upsertFeed.run(url, kind, title, siteUrl, etag, lastModified, now, 200, null);
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

// Refresh feeds endpoint
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
                COUNT(CASE WHEN i.is_read = 0 THEN 1 END) as unreadCount
            FROM feeds f
            LEFT JOIN items i ON f.url = i.feed_url
            GROUP BY f.url
            ORDER BY f.title ASC
        `).all();

        return {
            ok: true,
            feeds: feedsData
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

    const url = body.url.trim();
    const refresh = body.refresh === true;

    // Validate URL
    if (!url.match(/^https?:\/\/.+/)) {
        reply.code(400);
        return {
            ok: false,
            error: 'Invalid URL format'
        };
    }

    try {
        // Detect feed kind
        const kind = detectFeedKind(url);

        // Insert feed if not exists
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO feeds (url, kind, title, site_url, etag, last_modified, last_checked, last_status, last_error)
            VALUES (?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
        `);
        stmt.run(url, kind);

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

        // Process each feed
        for (const feed of feedsToImport) {
            const url = feed.xmlUrl.trim();

            // Validate URL format
            if (!url.match(/^https?:\/\/.+/)) {
                failed.push({ url, error: 'Invalid URL format' });
                continue;
            }

            // Skip if already exists
            if (existingUrls.has(url)) {
                skipped++;
                continue;
            }

            try {
                // Detect feed kind
                const kind = detectFeedKind(url);

                // Insert feed (reuse same logic as POST /feeds)
                const stmt = db.prepare(`
                    INSERT INTO feeds (url, kind, title, site_url, etag, last_modified, last_checked, last_status, last_error)
                    VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL)
                `);
                stmt.run(url, kind, feed.title);

                existingUrls.add(url);
                added++;
            } catch (error: any) {
                failed.push({ url, error: error.message || 'Database error' });
            }
        }

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
    const unreadOnly = query.unreadOnly === 'true';
    const starredOnly = query.starredOnly === '1' || query.starredOnly === 'true';
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const offset = parseInt(query.offset || '0', 10);

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (feed) {
        conditions.push('feed_url = ?');
        params.push(feed);
    }

    if (source && ['generic', 'youtube', 'reddit'].includes(source)) {
        conditions.push('source = ?');
        params.push(source);
    }

    if (unreadOnly) {
        conditions.push('is_read = 0');
    }

    if (starredOnly) {
        conditions.push('is_starred = 1');
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM items ${whereClause}`;
    const countResult = db.prepare(countQuery).get(...params) as any;
    const total = countResult.total;

    // Get items
    const itemsQuery = `
        SELECT 
            id, feed_url, source, title, url, author, summary, content,
            published, updated, media_thumbnail, media_duration_seconds,
            external_id, raw_guid, created_at, is_read, is_starred
        FROM items
        ${whereClause}
        ORDER BY 
            CASE WHEN published IS NOT NULL THEN published ELSE created_at END DESC
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

// Reader View endpoint
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

    try {
        // Fetch the page HTML
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            signal: controller.signal,
            redirect: 'follow'
        });

        clearTimeout(timeout);

        if (!response.ok) {
            reply.code(response.status);
            return {
                ok: false,
                error: `Failed to fetch: ${response.statusText}`
            };
        }

        const html = await response.text();
        const finalUrl = response.url || targetUrl;

        // Parse with JSDOM
        const dom = new JSDOM(html, { url: finalUrl });
        const document = dom.window.document;

        // Pre-strip junk before Readability
        const junkSelectors = [
            'header', 'footer', 'nav', 'aside', 'form', 'noscript',
            '[class*="ad"]', '[class*="ads"]', '[class*="advert"]',
            '[class*="sponsor"]', '[class*="promo"]', '[class*="cookie"]',
            '[class*="consent"]', '[class*="subscribe"]', '[class*="newsletter"]',
            '[class*="share"]', '[class*="social"]', '[class*="sidebar"]',
            '[class*="comments"]', '[id*="ad"]', '[id*="ads"]',
            '[id*="advert"]', '[id*="sponsor"]', '[id*="promo"]',
            '[id*="cookie"]', '[id*="consent"]', '[id*="subscribe"]',
            '[id*="newsletter"]', '[id*="share"]', '[id*="social"]',
            '[id*="sidebar"]', '[id*="comments"]'
        ];

        junkSelectors.forEach(selector => {
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

        // Parse the article content
        const contentDom = new JSDOM(article.content);
        const contentDoc = contentDom.window.document;

        // Extract header image
        let imageUrl: string | null = null;

        // Try first image in article content
        const images = contentDoc.querySelectorAll('img');
        for (const img of Array.from(images)) {
            const src = (img as HTMLImageElement).getAttribute('src');
            if (src && isUsableImage(src)) {
                imageUrl = normalizeUrl(src, finalUrl);
                break;
            }
        }

        // Fallback to meta tags
        if (!imageUrl) {
            const ogImage = document.querySelector('meta[property="og:image"]');
            const twitterImage = document.querySelector('meta[name="twitter:image"]');

            if (ogImage) {
                const content = ogImage.getAttribute('content');
                if (content) imageUrl = normalizeUrl(content, finalUrl);
            } else if (twitterImage) {
                const content = twitterImage.getAttribute('content');
                if (content) imageUrl = normalizeUrl(content, finalUrl);
            }
        }

        // Remove all headings from content
        contentDoc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el: Element) => el.remove());

        // Remove all images from content
        contentDoc.querySelectorAll('img').forEach((el: Element) => el.remove());

        // Get cleaned HTML
        const cleanedHtml = contentDoc.body.innerHTML;

        return {
            ok: true,
            url: finalUrl,
            imageUrl,
            html: cleanedHtml
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
