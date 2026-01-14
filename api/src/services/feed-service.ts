import { db } from '../db/client.js';
import Parser from 'rss-parser';
import { createHash } from 'crypto';
import { JSDOM } from 'jsdom';
import { detectFeedKind } from '../utils/feed-utils.js';
import { getJobStatus } from './import-service.js';

const FETCH_TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || '12000', 10);
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Prepared statements
const getFeed = db.prepare(`
  SELECT url, kind, etag, last_modified, next_retry_after, title FROM feeds WHERE url = ?
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
        'User-Agent': 'FeedStream/1.0 (compatible; RSS Reader; +http://localhost:3000)'
    },
    customFields: {
        feed: [
            ['itunes:image', 'itunesImage'],
            ['itunes:author', 'itunesAuthor'],
            ['itunes:summary', 'itunesSummary'],
            ['itunes:category', 'itunesCategory']
        ] as any,
        item: [
            ['media:thumbnail', 'mediaThumbnail'],
            ['media:content', 'mediaContent'],
            ['media:group', 'mediaGroup'],
            ['yt:videoId', 'ytVideoId'],
            ['yt:channelId', 'ytChannelId'],
            ['itunes:image', 'itunesImage'],
            ['itunes:duration', 'itunesDuration'],
            ['content:encoded', 'contentEncoded']
        ] as any
    }
});

// Helper functions (copied from index.ts)

function normalizeUrlString(url: string | null): string | null {
    if (!url) return null;
    try {
        const u = new URL(url);
        // Strip common tracking params
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref', 'source'].forEach(p => u.searchParams.delete(p));
        return u.toString();
    } catch {
        return url;
    }
}

function extractItemUrl(item: any): string | null {
    if (item.link) return item.link;
    if (item.enclosure && item.enclosure.url) return item.enclosure.url;
    return null;
}

// Helper: Fetch icon for a feed
export async function fetchFeedIcon(feedUrl: string, kind: string, siteUrl?: string | null, feedData?: any): Promise<string | null> {
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
                            'User-Agent': BROWSER_USER_AGENT
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
                    console.error(`Failed to scrape YT avatar for ${channelId}: ${e}`);
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
                    console.error(`Failed to fetch Reddit icon for ${subreddit}: ${e}`);
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

function parseYouTubeFeed(text: string, xmlParser: any): { title: string | null; link: string | null; items: any[] } | null {
    try {
        const parsed = xmlParser.parse(text);
        const feed = parsed?.feed;
        if (!feed) return null;

        const title = typeof feed.title === 'string' ? feed.title : feed.title?.['#text'] || null;
        const link = extractItemUrl(feed) || null;
        const entries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];

        const items = entries.map((entry: any) => {
            const mediaGroup = entry['media:group'] || {};
            const thumbnail = mediaGroup['media:thumbnail'] || null;
            const thumbnailUrl = Array.isArray(thumbnail)
                ? thumbnail[0]?.['@_url'] || thumbnail[0]?.url
                : thumbnail?.['@_url'] || thumbnail?.url;

            return {
                title: entry.title || null,
                link: extractItemUrl(entry) || null,
                author: entry.author?.name || entry.author || null,
                summary: mediaGroup['media:description'] || entry.summary || null,
                content: mediaGroup['media:description'] || entry.content || null,
                pubDate: entry.published || null,
                updated: entry.updated || null,
                guid: entry.id || null,
                ytVideoId: entry['yt:videoId'] || null,
                ytChannelId: entry['yt:channelId'] || null,
                mediaThumbnail: thumbnailUrl ? { url: thumbnailUrl } : null
            };
        });

        return { title, link, items };
    } catch {
        return null;
    }
}

function extractYouTubeMetadata(item: any): any {
    const metadata: any = {
        external_id: null,
        media_thumbnail: null,
        media_duration_seconds: null
    };

    if (item.ytVideoId) {
        metadata.external_id = item.ytVideoId;
        metadata.media_thumbnail = `https://i.ytimg.com/vi/${item.ytVideoId}/maxresdefault.jpg`;
    } else if (item.link) {
        // Try to extract from URL
        const match = item.link.match(/[?&]v=([^&]+)/);
        if (match) {
            metadata.external_id = match[1];
            metadata.media_thumbnail = `https://i.ytimg.com/vi/${match[1]}/maxresdefault.jpg`;
        }
    }

    // Fallback thumbnail from media:group
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

function extractRedditMetadata(item: any): any {
    const metadata: any = {
        external_id: null,
        media_thumbnail: null
    };

    const content = item.content || item.summary || '';
    const isVideo = content.includes('v.redd.it') || content.includes('player') || content.includes('video');

    if (content) {
        const imgMatch = content.match(/<img[^>]+src="([^"]+)"/i);
        if (imgMatch) {
            const src = imgMatch[1];
            if (!isVideo) {
                metadata.media_thumbnail = src;
            }
        }
    }
    return metadata;
}

function cleanRedditContent(html: string): string {
    if (!html) return html;
    let cleaned = html;
    cleaned = cleaned.replace(/<span[^>]*>.*?submitted by.*?to.*?<\/span>/gi, '');
    cleaned = cleaned.replace(/submitted by.*?to.*?<br\s*\/?>/gi, '');
    cleaned = cleaned.replace(/<a[^>]*>\[link\]<\/a>/gi, '');
    cleaned = cleaned.replace(/<a[^>]*>\[comments\]<\/a>/gi, '');
    cleaned = cleaned.replace(/<a[^>]*>https?:\/\/v\.redd\.it\/[^<]*<\/a>/gi, '');
    cleaned = cleaned.replace(/(<br\s*\/?>\s*){2,}/gi, '<br/>');
    cleaned = cleaned.replace(/<a[^>]*><\/a>/gi, '');
    cleaned = cleaned.replace(/<span[^>]*><\/span>/gi, '');
    return cleaned.trim();
}

function extractHeroImage(item: any): string | null {
    if (item.mediaThumbnail) {
        if (typeof item.mediaThumbnail === 'string') return item.mediaThumbnail;
        if (item.mediaThumbnail.url) return item.mediaThumbnail.url;
        if (item.mediaThumbnail['@_url']) return item.mediaThumbnail['@_url'];
    }
    if (item.enclosure && item.enclosure.url && item.enclosure.type?.startsWith('image/')) {
        return item.enclosure.url;
    }
    const content = item.content || item['content:encoded'] || item.summary || '';
    const ogImageMatch = content.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (ogImageMatch) return ogImageMatch[1];
    const twitterImageMatch = content.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    if (twitterImageMatch) return twitterImageMatch[1];
    const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgMatch) {
        const imgSrc = imgMatch[1];
        const lower = imgSrc.toLowerCase();
        if (!lower.includes('icon') && !lower.includes('logo') && !lower.includes('avatar') &&
            !lower.includes('favicon') && !lower.includes('button') && !lower.includes('spinner')) {
            return imgSrc;
        }
    }
    return null;
}

function generateItemId(feedUrl: string, item: any, index: number, externalId?: string): string {
    const guid = externalId || item.guid || item.id || item.link || item.title || item.pubDate || index.toString();
    const input = `${feedUrl}|${guid}`;
    return createHash('sha256').update(input).digest('hex');
}

function normalizeItem(item: any, kind: 'youtube' | 'reddit' | 'podcast' | 'generic'): any {
    const rawPublished = item.pubDate || item.isoDate || item.date_published || null;
    const rawUpdated = item.updated || item.date_modified || null;

    let published = null;
    let updated = null;
    const now = new Date();

    try {
        if (rawPublished) {
            const date = new Date(rawPublished);
            if (!isNaN(date.getTime())) {
                if (date > now) {
                    published = now.toISOString();
                } else {
                    published = date.toISOString();
                }
            } else {
                published = null;
            }
        }
    } catch (e) {
        published = null;
    }

    try {
        if (rawUpdated) {
            const date = new Date(rawUpdated);
            if (!isNaN(date.getTime())) {
                updated = date.toISOString();
            } else {
                updated = null;
            }
        }
    } catch (e) {
        updated = null;
    }

    const normalized: any = {
        title: item.title || null,
        url: normalizeUrlString(extractItemUrl(item)),
        author: item.creator || item.author?.name || item.author || null,
        summary: item.contentSnippet || item.summary || null,
        content: item.content || item['content:encoded'] || null,
        published,
        updated,
        raw_guid: item.guid || item.id || null,
        source: kind,
        media_thumbnail: null,
        media_duration_seconds: null,
        external_id: null
    };

    if (kind === 'youtube') {
        const ytMeta = extractYouTubeMetadata(item);
        Object.assign(normalized, ytMeta);
    } else if (kind === 'reddit') {
        const redditMeta = extractRedditMetadata(item);
        Object.assign(normalized, redditMeta);
        if (normalized.content) normalized.content = cleanRedditContent(normalized.content);
        if (normalized.summary) normalized.summary = cleanRedditContent(normalized.summary);
    }

    if (!normalized.media_thumbnail) {
        normalized.media_thumbnail = extractHeroImage(item);
    }

    return normalized;
}

export async function fetchFeed(url: string, force: boolean): Promise<any> {
    const feedRecord = getFeed.get(url) as any;
    let kind = feedRecord?.kind || detectFeedKind(url);

    if (kind === 'generic') {
        const upgradedKind = detectFeedKind(url);
        if (upgradedKind !== 'generic') kind = upgradedKind;
    }

    if (!force && feedRecord?.next_retry_after) {
        const now = new Date();
        const retryAfter = new Date(feedRecord.next_retry_after);

        if (now < retryAfter) {
            console.log(`Skipping ${url} - in backoff until ${feedRecord.next_retry_after}`);
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
        'User-Agent': kind === 'youtube' ? BROWSER_USER_AGENT : 'FeedStream/1.0 (compatible; RSS Reader; +http://localhost:3000)'
    };

    if (kind === 'youtube') {
        headers['Accept'] = 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.1';
        headers['Accept-Language'] = 'en-US,en;q=0.9';
    }

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

        if (response.status === 304) {
            updateFeedChecked.run(now, 304, url);
            return {
                url,
                kind,
                status: 304,
                title: feedRecord?.title || null,
                newItems: 0,
                totalItemsParsed: 0,
                totalItemsStored: (countItemsByFeed.get(url) as any)?.count || 0
            };
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        const etag = response.headers.get('etag') || null;
        const lastModified = response.headers.get('last-modified') || null;

        const siteUrl = new URL(url).origin;
        let parsed;
        try {
             parsed = await rssParser.parseString(text);
        } catch (e) {
             console.error("RSS Parsing failed", e);
             throw new Error("Failed to parse RSS feed");
        }

        const title = parsed.title || feedRecord?.title || url;
        const icon_url = feedRecord?.icon_url || null; // Could fetch icon here if missing

        upsertFeed.run(
            url,
            kind,
            title,
            siteUrl,
            etag,
            lastModified,
            now,
            response.status,
            null,
            icon_url
        );

        let newItems = 0;
        let totalItemsParsed = 0;

        const items = parsed.items || [];
        totalItemsParsed = items.length;

        const transaction = db.transaction((feedItems: any[]) => {
            let count = 0;
            feedItems.forEach((item, index) => {
                 const normalized = normalizeItem(item, kind as any);
                 if (!normalized.url) return;

                 // Only store recent items (e.g. last 3 months) to keep DB clean?
                 // For now, store all.

                 const id = generateItemId(url, item, index, normalized.raw_guid);
                 
                 try {
                     const existing = db.prepare('SELECT id FROM items WHERE id = ?').get(id);
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
                     
                     if (!existing) count++;
                 } catch (e) {
                     console.error("Item insert error", e);
                 }
            });
            return count;
        });

        newItems = transaction(items);

        return {
            url,
            kind,
            status: response.status,
            title,
            newItems,
            totalItemsParsed,
            totalItemsStored: (countItemsByFeed.get(url) as any)?.count || 0
        };

    } catch (error: any) {
        clearTimeout(timeout);
        const now = new Date().toISOString();
        
        // Simple backoff: 1 hour * retry_count (max 24h?)
        // Ideally should track retry_count in DB. For now just set last_error.
        
        db.prepare(`
            UPDATE feeds 
            SET last_checked = ?, last_status = ?, last_error = ?
            WHERE url = ?
        `).run(now, 0, error.message, url);

        return {
            url,
            kind,
            status: 0,
            title: feedRecord?.title || null,
            newItems: 0,
            error: error.message
        };
    }
}
