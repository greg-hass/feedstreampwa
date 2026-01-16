import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { searchFeeds, searchRSS, SearchResult } from '../feed-search.js';
import { aiRecommendationService } from '../services/ai-recommendations.js';
import { fetchFeed, fetchFeedIcon } from '../services/feed-service.js';
import { detectFeedKind } from '../utils/feed-utils.js';
import { authenticateToken } from '../middleware/auth.js';
import {
    AddFeedSchema,
    RenameFeedSchema,
    SearchFeedsQuerySchema,
    FeedSchema
} from '../types/schemas.js';

export default async function feedRoutes(fastify: FastifyInstance, options: any) {
    // Get feeds endpoint
    fastify.get('/feeds', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Optimized query using JOINs instead of subqueries to avoid N+1 problem
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
                    COUNT(CASE WHEN i.is_read = 0 THEN 1 END) as unreadCount,
                    GROUP_CONCAT(DISTINCT ff.folder_id) as folderIds
                FROM feeds f
                LEFT JOIN items i ON i.feed_url = f.url
                LEFT JOIN folder_feeds ff ON ff.feed_url = f.url
                GROUP BY f.url, f.kind, f.title, f.site_url, f.last_checked,
                         f.last_status, f.last_error, f.icon_url, f.custom_title
                ORDER BY f.title ASC
            `).all() as any[];

            // Enhance feeds with smartFolder and folders
            const enhancedFeeds = feedsData.map((feed) => {
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
                    folders: feed.folderIds ? feed.folderIds.split(',') : []
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
    // Feed search - expensive operation, moderate rate limit
    fastify.get('/feeds/search', {
        config: {
            rateLimit: {
                max: 20,
                timeWindow: '1 minute'
            }
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const result = SearchFeedsQuerySchema.safeParse(request.query);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const { q: searchQuery, type: searchType } = result.data;

        // Handle multiple types (comma-separated)
        let typesToSearch: ('rss' | 'youtube' | 'reddit' | 'podcast')[] = [];

        if (searchType === 'all') {
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

    // AI-powered feed recommendations - expensive AI operation, strict rate limit
    fastify.get('/feeds/recommendations', {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: '1 minute'
            }
        }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const query = request.query as any;
        const limit = Math.min(parseInt(query?.limit || '5', 10), 10); // Max 10 recommendations
        const debug = query?.debug === 'true' || query?.debug === '1';
        const dryRun = query?.dryRun === 'true' || query?.dryRun === '1';

        const buildDebugInfo = () => {
            const hasEnvKey = Boolean(env.GEMINI_API_KEY);
            let hasDbKey = false;
            try {
                const dbKey = db.prepare('SELECT value FROM meta WHERE key = ?').get('gemini_api_key') as any;
                hasDbKey = Boolean(dbKey?.value);
            } catch (err) {
                hasDbKey = false;
            }

            const feedCountResult = db.prepare('SELECT COUNT(*) as count FROM feeds').get() as any;
            const feedsByKindRows = db.prepare('SELECT kind, COUNT(*) as count FROM feeds GROUP BY kind').all() as Array<{ kind: string; count: number }>;
            const feedsByKind: Record<string, number> = {
                generic: 0,
                youtube: 0,
                reddit: 0,
                podcast: 0
            };
            feedsByKindRows.forEach((row) => {
                feedsByKind[row.kind] = row.count;
            });

            const readCountResult = db.prepare('SELECT COUNT(*) as count FROM items WHERE is_read = 1').get() as any;
            const starredCountResult = db.prepare('SELECT COUNT(*) as count FROM items WHERE is_starred = 1').get() as any;
            const historyCountResult = db.prepare('SELECT COUNT(*) as count FROM items WHERE is_read = 1 OR is_starred = 1').get() as any;
            const lastInteractionResult = db.prepare(`
                SELECT MAX(COALESCE(updated, published, created_at)) as lastInteractionAt
                FROM items
                WHERE is_read = 1 OR is_starred = 1
            `).get() as any;

            return {
                hasGeminiKey: hasDbKey || hasEnvKey,
                hasDbKey,
                hasEnvKey,
                feedCount: feedCountResult?.count || 0,
                feedsByKind,
                historyCount: historyCountResult?.count || 0,
                readCount: readCountResult?.count || 0,
                starredCount: starredCountResult?.count || 0,
                lastInteractionAt: lastInteractionResult?.lastInteractionAt || null
            };
        };

        const debugInfoBase = debug ? buildDebugInfo() : null;
        let promptPreview: string | null = null;
        let debugError: string | null = null;

        if (debug) {
            try {
                promptPreview = await aiRecommendationService.getPromptPreview(db, limit);
            } catch (err: any) {
                debugError = err instanceof Error ? err.message : 'Failed to build prompt preview';
            }
        }

        try {
            if (debug && dryRun) {
                return {
                    ok: true,
                    recommendations: [],
                    count: 0,
                    debug: {
                        ...debugInfoBase,
                        model: aiRecommendationService.getModelName(),
                        promptPreview,
                        lastError: debugError
                    }
                };
            }

            // Generate recommendations (service will validate API key)
            const recommendations = await aiRecommendationService.generateRecommendations(db, limit);

            return {
                ok: true,
                recommendations,
                count: recommendations.length,
                ...(debug ? {
                    debug: {
                        ...debugInfoBase,
                        model: aiRecommendationService.getModelName(),
                        promptPreview,
                        lastError: debugError
                    }
                } : {})
            };
        } catch (error: any) {
            fastify.log.error('Error generating recommendations:', error);
            if (debug) {
                debugError = error instanceof Error ? error.message : 'Failed to generate recommendations';
            }
            return {
                ok: false,
                error: error.message || 'Failed to generate recommendations',
                recommendations: [],
                ...(debug ? {
                    debug: {
                        ...debugInfoBase,
                        model: aiRecommendationService.getModelName(),
                        promptPreview,
                        lastError: debugError
                    }
                } : {})
            };
        }
    });

    // Add feed endpoint
    fastify.post('/feeds', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = AddFeedSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        let { url, refresh, folderIds, title: providedTitle } = result.data;

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
            if (folderIds && folderIds.length > 0) {
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
    fastify.patch('/feeds', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = RenameFeedSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const { url, title } = result.data;

        try {
            const updateResult = db.prepare(`
                UPDATE feeds SET custom_title = ?, title = COALESCE(?, title) WHERE url = ?
            `).run(title, title, url);

            if (updateResult.changes === 0) {
                reply.code(404);
                return { ok: false, error: 'Feed not found' };
            }

            return { ok: true };
        } catch (error: any) {
            fastify.log.error({ error, url, title }, 'Failed to update feed title');
            reply.code(500);
            return { ok: false, error: 'Failed to update feed title in database' };
        }
    });

    // Delete feed endpoint
    fastify.delete('/feeds', async (request: FastifyRequest, reply: FastifyReply) => {
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
            // Wrap multi-table deletion in transaction for atomicity
            const result = db.transaction(() => {
                // Delete items first (foreign key constraint)
                const deleteItems = db.prepare('DELETE FROM items WHERE feed_url = ?');
                deleteItems.run(url);

                // Delete folder associations
                const deleteFolderFeeds = db.prepare('DELETE FROM folder_feeds WHERE feed_url = ?');
                deleteFolderFeeds.run(url);

                // Delete feed
                const deleteFeed = db.prepare('DELETE FROM feeds WHERE url = ?');
                return deleteFeed.run(url);
            })();

            if (result.changes === 0) {
                reply.code(404);
                return {
                    ok: false,
                    error: 'Feed not found'
                };
            }

            fastify.log.info({ url }, 'Successfully deleted feed and associated data');
            return {
                ok: true
            };
        } catch (error: any) {
            fastify.log.error({ error, url }, 'Failed to delete feed');
            reply.code(500);
            return {
                ok: false,
                error: 'Failed to delete feed from database'
            };
        }
    });
}
