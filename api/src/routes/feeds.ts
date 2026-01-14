import { db } from '../db/client.js';
import { searchFeeds, searchRSS, SearchResult } from '../feed-search.js';
import { aiRecommendationService } from '../services/ai-recommendations.js';
import { fetchFeed, fetchFeedIcon } from '../services/feed-service.js';
import { detectFeedKind } from '../utils/feed-utils.js';

export default async function feedRoutes(fastify: any, options: any) {
    // Get feeds endpoint
    fastify.get('/feeds', async (request: any, reply: any) => {
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
                let smartFolder: 'rss' | 'youtube' | 'reddit' | 'podcast' = 'rss';
                if (feed.kind === 'youtube') {
                    smartFolder = 'youtube';
                } else if (feed.kind === 'reddit') {
                    smartFolder = 'reddit';
                } else if (feed.kind === 'podcast') {
                    smartFolder = 'podcast';
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
    fastify.get('/feeds/search', async (request: any, reply: any) => {
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

        // Handle multiple types (comma-separated)
        let typesToSearch: ('rss' | 'youtube' | 'reddit' | 'podcast')[] = [];

        if (searchType === 'all' || !searchType) {
            typesToSearch = ['rss', 'youtube', 'reddit', 'podcast'];
        } else {
            // Split comma-separated types
            const types = searchType.split(',').map((t: string) => t.trim());
            const validTypes = ['rss', 'youtube', 'reddit', 'podcast'];
            typesToSearch = types.filter((t: string) => validTypes.includes(t)) as ('rss' | 'youtube' | 'reddit' | 'podcast')[];

            if (typesToSearch.length === 0) {
                reply.code(400);
                return {
                    ok: false,
                    error: 'Invalid type parameter. Must be one or more of: rss, youtube, reddit, podcast (comma-separated)'
                };
            }
        }

        try {
            // Aggregate results from all requested types
            const allResults: any[] = [];

            for (const type of typesToSearch) {
                if (type === 'podcast') {
                    // Podcast search - similar to RSS but focus on audio feeds
                    const rssResults = await searchRSS(searchQuery);
                    allResults.push(...rssResults.map((r: SearchResult) => ({ ...r, type: 'podcast' })));
                } else {
                    const results = await searchFeeds(searchQuery, type as 'rss' | 'youtube' | 'reddit');
                    allResults.push(...results);
                }
            }

            return {
                ok: true,
                results: allResults
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

    // AI-powered feed recommendations
    fastify.get('/feeds/recommendations', async (request: any, reply: any) => {
        const query = request.query as any;
        const limit = Math.min(parseInt(query?.limit || '5', 10), 10); // Max 10 recommendations

        try {
            // Check if AI service is available
            if (!aiRecommendationService.isAvailable()) {
                return {
                    ok: false,
                    error: 'AI recommendations not available. Please configure GEMINI_API_KEY environment variable.',
                    recommendations: []
                };
            }

            // Generate recommendations
            const recommendations = await aiRecommendationService.generateRecommendations(db, limit);

            return {
                ok: true,
                recommendations,
                count: recommendations.length
            };
        } catch (error: any) {
            console.error('Error generating recommendations:', error);
            return {
                ok: false,
                error: error.message || 'Failed to generate recommendations',
                recommendations: []
            };
        }
    });

    // Add feed endpoint
    fastify.post('/feeds', async (request: any, reply: any) => {
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
        const providedTitle = typeof body.title === 'string' ? body.title.trim() : null;

        // YouTube URL conversion: handle/channel to RSS
        let extractedTitle: string | null = providedTitle || null;
        const isAlreadyYoutubeRSS = url.includes('youtube.com/feeds/videos.xml');

        if (url.includes('youtube.com/') && !isAlreadyYoutubeRSS) {
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
                        if (titleMatch && !extractedTitle) {
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
                            if (titleMatch && !extractedTitle) extractedTitle = titleMatch[1];
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
                INSERT INTO feeds (url, kind, title, site_url, etag, last_modified, last_checked, last_status, last_error, icon_url, retry_count)
                VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, 0)
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
    fastify.patch('/feeds', async (request: any, reply: any) => {
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
    fastify.delete('/feeds', async (request: any, reply: any) => {
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
}
