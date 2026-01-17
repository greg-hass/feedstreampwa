import { db } from '../db/client.js';
import Parser from 'rss-parser';
import { createHash } from 'crypto';
import { detectFeedKind } from '../utils/feed-utils.js';
import { Feed, FeedKind, Item } from '../types/schemas.js';
import logger from '../utils/logger.js';

// Configuration Constants
const FETCH_TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || '12000', 10);
const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// URL Tracking Parameters to Strip
const TRACKING_PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'fbclid',
    'gclid',
    'ref',
    'source'
] as const;

// Parsed Interfaces
interface ParsedFeedItem {
    title?: string;
    link?: string;
    pubDate?: string;
    creator?: string;
    content?: string;
    contentSnippet?: string;
    guid?: string;
    id?: string;
    isoDate?: string;
    date_published?: string;
    updated?: string;
    date_modified?: string;
    author?: string | { name: string };
    summary?: string;
    'content:encoded'?: string;
    enclosure?: { url?: string; type?: string; length?: string; '@_url'?: string } | string;
    enclosures?: { url?: string; type?: string; length?: string; '@_url'?: string }[];
    itunesDuration?: string;
    mediaContent?: {
        duration?: string | number;
        url?: string;
        '@_url'?: string;
    } | {
        duration?: string | number;
        url?: string;
        '@_url'?: string;
    }[];
    
    // YouTube specific
    ytVideoId?: string;
    ytChannelId?: string;
    mediaGroup?: {
        'media:thumbnail'?: { url: string }[] | { url: string } | { '@_url': string };
        'media:description'?: string;
    };
}

interface NormalizedItem {
    title: string | null;
    url: string | null;
    author: string | null;
    summary: string | null;
    content: string | null;
    published: string | null;
    updated: string | null;
    raw_guid: string | null;
    source: FeedKind;
    media_thumbnail: string | null;
    media_duration_seconds: number | null;
    external_id: string | null;
    enclosure: string | null;
}

// Regex Constants for Content Cleaning and Parsing
// Reddit feed content cleanup patterns
const REDDIT_SUBMITTED_BY = /<span[^>]*>.*?submitted by.*?to.*?<\/span>/gi; // Remove "submitted by X to Y" text
const REDDIT_SUBMITTED_BY_BR = /submitted by.*?to.*?<br\s*\/?>/gi; // Remove "submitted by" with line break
const REDDIT_LINK_ANCHOR = /<a[^>]*>\[link\]<\/a>/gi; // Remove [link] anchors
const REDDIT_COMMENTS_ANCHOR = /<a[^>]*>\[comments\]<\/a>/gi; // Remove [comments] anchors
const REDDIT_VIDEO_ANCHOR = /<a[^>]*>https?:\/\/v\.redd\.it\/[^<]*<\/a>/gi; // Remove v.redd.it video links
const REDDIT_DOUBLE_BR = /(<br\s*\/?>\s*){2,}/gi; // Collapse multiple line breaks
const REDDIT_EMPTY_ANCHOR = /<a[^>]*><\/a>/gi; // Remove empty anchor tags
const REDDIT_EMPTY_SPAN = /<span[^>]*><\/span>/gi; // Remove empty span tags

// Image and metadata extraction patterns
const IMG_SRC_REGEX = /<img[^>]+src="([^"]+)"/i; // Extract img src attribute
const OG_IMAGE_REGEX = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i; // Extract OpenGraph image
const TWITTER_IMAGE_REGEX = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i; // Extract Twitter Card image
const IMG_TAG_REGEX = /<img[^>]+src=["']([^"']+)["'][^>]*>/i; // Extract first image tag

// YouTube and Reddit URL parsing patterns
const YOUTUBE_VIDEO_ID_REGEX = /[?&]v=([^&]+)/; // Extract YouTube video ID from URL
const YOUTUBE_CHANNEL_ID_PARAM = /channel_id=([^&]+)/; // Extract YouTube channel ID from URL parameter
const REDDIT_SUBREDDIT_REGEX = /reddit\.com\/r\/([^/?#.]+)/; // Extract subreddit name from URL

const getFeed = db.prepare(`
  SELECT url, kind, etag, last_modified, next_retry_after, title, icon_url FROM feeds WHERE url = ?
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
    external_id, raw_guid, created_at, enclosure
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    raw_guid = excluded.raw_guid,
    enclosure = excluded.enclosure
`);

const countItemsByFeed = db.prepare(`
  SELECT COUNT(*) as count FROM items WHERE feed_url = ?
`);

const getExistingItemIds = db.prepare(`
  SELECT id FROM items WHERE feed_url = ?
`);

// Initialize parsers
const rssParser = new Parser<any, ParsedFeedItem>({
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
        TRACKING_PARAMS.forEach(p => u.searchParams.delete(p));
        return u.toString();
    } catch {
        return url;
    }
}

function extractEnclosureUrl(item: ParsedFeedItem): string | null {
    const enclosure = item.enclosure;
    if (enclosure) {
        if (typeof enclosure === 'string') return enclosure;
        if (typeof enclosure === 'object') {
            if (enclosure.url) return enclosure.url;
            if (enclosure['@_url']) return enclosure['@_url'];
        }
    }

    if (item.enclosures && item.enclosures.length > 0) {
        const candidate = item.enclosures[0];
        if (candidate.url) return candidate.url;
        if (candidate['@_url']) return candidate['@_url'];
    }

    const mediaContentUrl = extractMediaContentUrl(item.mediaContent);
    if (mediaContentUrl) return mediaContentUrl;

    return null;
}

function extractMediaContentDuration(mediaContent: ParsedFeedItem['mediaContent']): unknown {
    if (!mediaContent) return null;
    if (Array.isArray(mediaContent)) return mediaContent[0]?.duration ?? null;
    if (typeof mediaContent === 'object' && 'duration' in mediaContent) return mediaContent.duration;
    return null;
}

function extractMediaContentUrl(mediaContent: ParsedFeedItem['mediaContent']): string | null {
    if (!mediaContent) return null;
    if (Array.isArray(mediaContent)) {
        const candidate = mediaContent[0];
        if (candidate?.url) return candidate.url;
        if (candidate && '@_url' in candidate && candidate['@_url']) return candidate['@_url'];
        return null;
    }
    if (typeof mediaContent === 'object') {
        if (mediaContent.url) return mediaContent.url;
        if ('@_url' in mediaContent && mediaContent['@_url']) return mediaContent['@_url'];
    }
    return null;
}

function isLikelyAudioUrl(url: string): boolean {
    return /\.(mp3|m4a|aac|ogg|opus|wav|flac)(\?|#|$)/i.test(url);
}

function parseDurationToSeconds(raw: unknown): number | null {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.max(0, Math.round(raw));
    }
    if (typeof raw !== 'string') return null;

    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
        return Math.max(0, parseInt(trimmed, 10));
    }

    const parts = trimmed.split(':').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0 || parts.length > 3) return null;

    const numbers = parts.map((part) => Number(part));
    if (numbers.some((n) => Number.isNaN(n))) return null;

    if (numbers.length === 3) {
        return Math.max(0, Math.round(numbers[0] * 3600 + numbers[1] * 60 + numbers[2]));
    }
    if (numbers.length === 2) {
        return Math.max(0, Math.round(numbers[0] * 60 + numbers[1]));
    }
    return Math.max(0, Math.round(numbers[0]));
}

function extractItemUrl(item: ParsedFeedItem): string | null {
    if (item.link) return item.link;
    const enclosureUrl = extractEnclosureUrl(item);
    if (enclosureUrl) return enclosureUrl;
    return null;
}

// Helper: Fetch icon for a feed
export async function fetchFeedIcon(feedUrl: string, kind: string, siteUrl?: string | null, feedData?: any): Promise<string | null> {
    try {
        if (kind === 'youtube') {
            // Extract channel ID from feed URL
            let channelId = feedUrl.match(YOUTUBE_CHANNEL_ID_PARAM)?.[1];

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
                            /yt-img-shadow.*?src="(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/,
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
                    logger.error(`Failed to scrape YT avatar for ${channelId}: ${e}`);
                }
            }
        } else if (kind === 'reddit') {
            const match = feedUrl.match(REDDIT_SUBREDDIT_REGEX);
            if (match) {
                const subreddit = match[1];
                try {
                    const response = await fetch(`https://www.reddit.com/r/${subreddit}/about.json`, {
                        headers: {
                            'User-Agent': BROWSER_USER_AGENT
                        }
                    });
                    if (response.ok) {
                        const json = (await response.json()) as any;
                        const icon = json.data?.community_icon || json.data?.icon_img;
                        if (icon) return icon.replace(/&amp;/g, '&');
                    }
                } catch (e) {
                    logger.error(`Failed to fetch Reddit icon for ${subreddit}: ${e}`);
                }
            }
        } else if (kind === 'podcast') {
            // Extract podcast artwork from feed data
            if (feedData) {
                const itunesImage =
                    extractImageUrl(feedData.itunesImage) ||
                    extractImageUrl(feedData.items?.[0]?.itunesImage);
                if (itunesImage) return itunesImage;

                const feedImage =
                    extractImageUrl(feedData.image) ||
                    extractImageUrl(feedData.items?.[0]?.image);
                if (feedImage) return feedImage;
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
        logger.error({ err: e }, `Failed to fetch icon for ${feedUrl}`);
    }
    return null;
}

function extractImageUrl(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value !== 'object') return null;

    const record = value as Record<string, unknown>;
    if (typeof record['@_href'] === 'string') return record['@_href'];
    if (typeof record['href'] === 'string') return record['href'];
    if (typeof record['url'] === 'string') return record['url'];
    if (typeof record['@_url'] === 'string') return record['@_url'];

    const nested = record['$'];
    if (nested && typeof nested === 'object') {
        const nestedRecord = nested as Record<string, unknown>;
        if (typeof nestedRecord['href'] === 'string') return nestedRecord['href'];
        if (typeof nestedRecord['url'] === 'string') return nestedRecord['url'];
    }

    return null;
}

function extractYouTubeMetadata(item: any): Partial<NormalizedItem> {
    const metadata: Partial<NormalizedItem> = {
        external_id: null,
        media_thumbnail: null,
        media_duration_seconds: null
    };

    if (item.ytVideoId) {
        metadata.external_id = item.ytVideoId;
        metadata.media_thumbnail = `https://i.ytimg.com/vi/${item.ytVideoId}/maxresdefault.jpg`;
    } else if (item.link) {
        // Try to extract from URL
        const match = item.link.match(YOUTUBE_VIDEO_ID_REGEX);
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
                 metadata.media_thumbnail = (thumbnail as any)['@_url'] || (thumbnail as any).url;
             }
         }
    }

    return metadata;
}

function extractRedditMetadata(item: ParsedFeedItem): Partial<NormalizedItem> {
    const metadata: Partial<NormalizedItem> = {
        external_id: null,
        media_thumbnail: null
    };

    const content = item.content || item.summary || '';
    const isVideo = content.includes('v.redd.it') || content.includes('player') || content.includes('video');

    if (content) {
        const imgMatch = content.match(IMG_SRC_REGEX);
        if (imgMatch) {
            const src = upgradeRedditImageUrl(imgMatch[1]);
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
    cleaned = cleaned.replace(REDDIT_SUBMITTED_BY, '');
    cleaned = cleaned.replace(REDDIT_SUBMITTED_BY_BR, '');
    cleaned = cleaned.replace(REDDIT_LINK_ANCHOR, '');
    cleaned = cleaned.replace(REDDIT_COMMENTS_ANCHOR, '');
    cleaned = cleaned.replace(REDDIT_VIDEO_ANCHOR, '');
    cleaned = cleaned.replace(REDDIT_DOUBLE_BR, '<br/>');
    cleaned = cleaned.replace(REDDIT_EMPTY_ANCHOR, '');
    cleaned = cleaned.replace(REDDIT_EMPTY_SPAN, '');
    return cleaned.trim();
}

function upgradeRedditImageUrl(url: string): string {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname;

        if (host === 'i.redd.it') {
            parsed.search = '';
            return parsed.toString();
        }

        if (host.endsWith('preview.redd.it') || host.endsWith('external-preview.redd.it')) {
            if (parsed.searchParams.has('width')) {
                parsed.searchParams.set('width', '1920');
            }
            if (parsed.searchParams.has('auto')) {
                parsed.searchParams.set('auto', 'webp');
            }
            return parsed.toString();
        }
    } catch {
        return url;
    }

    return url;
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
    const ogImageMatch = content.match(OG_IMAGE_REGEX);
    if (ogImageMatch) return ogImageMatch[1];
    const twitterImageMatch = content.match(TWITTER_IMAGE_REGEX);
    if (twitterImageMatch) return twitterImageMatch[1];
    const imgMatch = content.match(IMG_TAG_REGEX);
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

function generateItemId(feedUrl: string, item: ParsedFeedItem, index: number, externalId?: string | null): string {
    const guid = externalId || item.guid || item.id || item.link || item.title || item.pubDate;
    
    let identifier = guid;
    if (!identifier) {
        // Fallback to content hash if no other identifier exists
        // We avoid using index to prevent duplicates when feed order changes
        const content = item.content || item.summary || item.contentSnippet || '';
        identifier = createHash('sha256').update(content).digest('hex');
    }

    const input = `${feedUrl}|${identifier}`;
    return createHash('sha256').update(input).digest('hex');
}

function normalizeItem(item: ParsedFeedItem, kind: FeedKind): NormalizedItem {
    const rawPublished = item.pubDate || item.isoDate || item.date_published || null;
    const rawUpdated = item.updated || item.date_modified || null;

    const now = new Date();
    let published: string = now.toISOString();
    let updated: string | null = null;

    try {
        if (rawPublished) {
            const date = new Date(rawPublished);
            if (!isNaN(date.getTime())) {
                if (date > now) {
                    published = now.toISOString();
                } else {
                    published = date.toISOString();
                }
            }
        }
    } catch (e) {
        // Fallback already set to now
    }

    try {
        if (rawUpdated) {
            const date = new Date(rawUpdated);
            if (!isNaN(date.getTime())) {
                updated = date.toISOString();
            }
        }
    } catch (e) {
        updated = null;
    }

    const normalized: NormalizedItem = {
        title: item.title || null,
        url: normalizeUrlString(extractItemUrl(item)),
        author: (typeof item.author === 'string' ? item.author : item.author?.name) || item.creator || null,
        summary: item.contentSnippet || item.summary || null,
        content: item.content || item['content:encoded'] || null,
        published,
        updated,
        raw_guid: item.guid || item.id || null,
        source: kind,
        media_thumbnail: null,
        media_duration_seconds: null,
        external_id: null,
        enclosure: null
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

    let enclosureUrl = extractEnclosureUrl(item);
    if (!enclosureUrl && item.link && isLikelyAudioUrl(item.link)) {
        enclosureUrl = item.link;
    }
    if (enclosureUrl) {
        normalized.enclosure = enclosureUrl;
    }

    const durationSeconds = parseDurationToSeconds(item.itunesDuration)
        ?? parseDurationToSeconds(extractMediaContentDuration(item.mediaContent));
    if (durationSeconds && durationSeconds > 0) {
        normalized.media_duration_seconds = durationSeconds;
    }

    return normalized;
}

export async function fetchFeed(url: string, force: boolean): Promise<any> {
    const feedRecord = getFeed.get(url) as Feed | undefined;
    let kind = feedRecord?.kind || detectFeedKind(url);

    if (kind === 'generic') {
        const upgradedKind = detectFeedKind(url);
        if (upgradedKind !== 'generic') kind = upgradedKind;
    }

    if (!force && feedRecord?.last_checked) {
        // If last_status was error, use simple backoff if needed, otherwise rely on scheduler
        // But for now, we just proceed.
    }

    const headers: Record<string, string> = {
        'User-Agent': kind === 'youtube' || kind === 'reddit'
            ? BROWSER_USER_AGENT
            : 'FeedStream/1.0 (compatible; RSS Reader; +http://localhost:3000)'
    };

    if (kind === 'youtube' || kind === 'reddit') {
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
             logger.error({ err: e }, "RSS Parsing failed");
             throw new Error("Failed to parse RSS feed");
        }

        const title = parsed.title || feedRecord?.title || url;
        let icon_url = feedRecord?.icon_url || null;
        if (kind === 'podcast') {
            const podcastIcon = await fetchFeedIcon(url, kind, siteUrl, parsed);
            if (podcastIcon) icon_url = podcastIcon;
        }

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

        const transaction = db.transaction((feedItems: ParsedFeedItem[]) => {
            let count = 0;
            
            // Optimization: Get all existing IDs for this feed in one go
            const existingIds = new Set(
                (getExistingItemIds.all(url) as { id: string }[]).map(row => row.id)
            );

            feedItems.forEach((item, index) => {
                 const normalized = normalizeItem(item, kind as FeedKind);
                 if (!normalized.url) return;

                 const id = generateItemId(url, item, index, normalized.raw_guid);
                 
                 try {
                     const isNew = !existingIds.has(id);
                     
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
                        now,
                        normalized.enclosure
                     );
                     
                     if (isNew) count++;
                 } catch (e) {
                     logger.error({ err: e }, "Item insert error");
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
