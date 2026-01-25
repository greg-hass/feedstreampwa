import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { authenticateToken } from '../middleware/auth.js';
import {
    GetItemsQuerySchema,
    MarkReadSchema,
    MarkAllReadSchema,
    StarItemSchema,
    PlaybackPositionSchema
} from '../types/schemas.js';

function buildFtsQuery(query: string): string {
    const tokens = query
        .trim()
        .split(/\s+/)
        .map((token) => token.replace(/"/g, '""'))
        .filter(Boolean);

    if (tokens.length === 0) {
        return '""';
    }

    return tokens.map((token) => `"${token}"`).join(' AND ');
}

export default async function itemRoutes(fastify: FastifyInstance, options: any) {
    // Get items endpoint
    fastify.get('/items', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = GetItemsQuerySchema.safeParse(request.query);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const query = result.data;

        // Parse query parameters
        const feed = query.feed || null;
        const source = query.source || null;
        const smartFolder = query.smartFolder || null;
        const folderId = query.folderId || null;
        const unreadOnly = query.unreadOnly === true;
        const starredOnly = query.starredOnly === true;
        const since = query.since || null;
        let isPodcastRequest =
            smartFolder === 'podcast' ||
            source === 'podcast';
        if (!isPodcastRequest && feed) {
            const feedRow = db.prepare('SELECT kind FROM feeds WHERE url = ?').get(feed) as { kind?: string } | undefined;
            if (feedRow?.kind === 'podcast') isPodcastRequest = true;
        }
        const maxLimit = isPodcastRequest ? 10 : 200;
        const fallbackLimit = isPodcastRequest ? 10 : 20;
        const limit = Math.min(query.limit || fallbackLimit, maxLimit) || fallbackLimit;
        const offset = isPodcastRequest ? 0 : query.offset;
        const q = query.q ? query.q.trim() : null;
        const timeFilter = query.timeFilter || 'all';

        // Build WHERE clause using safe query builder pattern
        interface QueryCondition {
            clause: string;
            params: any[];
        }

        const conditions: QueryCondition[] = [];

        // Whitelist and validate filter parameters
        const ALLOWED_SOURCES = ['generic', 'youtube', 'reddit', 'podcast'] as const;
        const ALLOWED_SMART_FOLDERS = ['rss', 'youtube', 'reddit', 'podcast'] as const;

        if (feed) {
            conditions.push({
                clause: 'i.feed_url = ?',
                params: [feed]
            });
        }

        if (source && ALLOWED_SOURCES.includes(source as any)) {
            conditions.push({
                clause: 'i.source = ?',
                params: [source]
            });
        }

        // Smart folder filter (by feed kind)
        if (smartFolder && ALLOWED_SMART_FOLDERS.includes(smartFolder as any)) {
            const kindMap: Record<string, string> = {
                'rss': 'generic',
                'youtube': 'youtube',
                'reddit': 'reddit',
                'podcast': 'podcast'
            };
            conditions.push({
                clause: 'f.kind = ?',
                params: [kindMap[smartFolder]]
            });
        }

        // Custom folder filter
        if (folderId) {
            conditions.push({
                clause: 'i.feed_url IN (SELECT feed_url FROM folder_feeds WHERE folder_id = ?)',
                params: [folderId]
            });
        }

        if (unreadOnly) {
            conditions.push({
                clause: 'i.is_read = 0',
                params: []
            });
        }

        if (starredOnly) {
            conditions.push({
                clause: 'i.is_starred = 1',
                params: []
            });
        }

        // Delta updates: only return items created after the 'since' timestamp
        if (since) {
            conditions.push({
                clause: 'i.created_at > ?',
                params: [since]
            });
        }

        const hasFts = Boolean(
            db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='items_fts'").get()
        );
        let useFts = Boolean(q) && hasFts;

        if (timeFilter && timeFilter !== 'all') {
            const dayMs = 24 * 60 * 60 * 1000;
            const now = Date.now();
            let cutoffMs = dayMs;
            if (timeFilter === 'week') {
                cutoffMs = 7 * dayMs;
            }

            const cutoffIso = new Date(now - cutoffMs).toISOString();
            conditions.push({
                clause: 'COALESCE(i.published, i.created_at) >= ?',
                params: [cutoffIso]
            });
        }

        const buildQueryParts = (useFullText: boolean) => {
            const searchConditions: QueryCondition[] = [];
            if (q) {
                if (useFullText) {
                    const ftsQuery = buildFtsQuery(q);
                    searchConditions.push({
                        clause: 'fts MATCH ?',
                        params: [ftsQuery]
                    });
                } else {
                    const likeQuery = `%${q}%`;
                    searchConditions.push({
                        clause: '(i.title LIKE ? OR i.summary LIKE ? OR i.content LIKE ?)',
                        params: [likeQuery, likeQuery, likeQuery]
                    });
                }
            }

            const allConditions = [...conditions, ...searchConditions];
            const whereClauses = allConditions.map(c => c.clause);
            const whereParams = allConditions.flatMap(c => c.params);
            const whereClause = whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : '';

            const baseFromClause = 'FROM items i INNER JOIN feeds f ON i.feed_url = f.url';
            const fromClause = useFullText
                ? `${baseFromClause} INNER JOIN items_fts fts ON i.rowid = fts.rowid`
                : baseFromClause;

            return { fromClause, whereClause, whereParams };
        };

        const runQuery = (useFullText: boolean) => {
            const { fromClause, whereClause, whereParams } = buildQueryParts(useFullText);

            const countQuery = `SELECT COUNT(*) as total ${fromClause} ${whereClause}`;
            const countResult = db.prepare(countQuery).get(...whereParams) as any;
            const total = countResult.total;

            const itemsQuery = `
                SELECT 
                    i.id, i.feed_url, i.source, i.title, i.url, i.author, i.summary, i.content,
                    i.published, i.updated, i.media_thumbnail, i.media_duration_seconds,
                    i.external_id, i.raw_guid, i.created_at, i.is_read, i.is_starred, i.playback_position, i.read_at, i.enclosure,
                    f.icon_url as feed_icon_url, COALESCE(f.custom_title, f.title) as feed_title
                ${fromClause}
                ${whereClause}
                ORDER BY COALESCE(i.published, i.created_at) DESC
                LIMIT ? OFFSET ?
            `;

            const items = db.prepare(itemsQuery).all(...whereParams, limit, offset);

            return { total, items };
        };

        try {
            const { total, items } = runQuery(useFts);
            return { ok: true, total, items };
        } catch (error) {
            if (useFts) {
                fastify.log.warn({ err: error }, 'FTS query failed, falling back to LIKE search');
                useFts = false;
            } else {
                throw error;
            }
        }

        const { total, items } = runQuery(useFts);
        return { ok: true, total, items };
    });

    // Get single item by ID
    fastify.get('/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };

        try {
            const item = db.prepare(`
                SELECT
                    i.id,
                    i.feed_url,
                    i.source,
                    i.url,
                    i.title,
                    i.author,
                    i.summary,
                    i.content,
                    i.published,
                    i.updated,
                    i.media_thumbnail,
                    i.media_duration_seconds,
                    i.external_id,
                    i.raw_guid,
                    i.created_at,
                    i.is_read,
                    i.is_starred,
                    i.playback_position,
                    i.read_at,
                    i.enclosure,
                    f.icon_url as feed_icon_url,
                    COALESCE(f.custom_title, f.title) as feed_title,
                    f.kind
                FROM items i
                LEFT JOIN feeds f ON i.feed_url = f.url
                WHERE i.id = ?
            `).get(id);

            if (!item) {
                reply.code(404);
                return { ok: false, error: 'Item not found' };
            }

            return { ok: true, item };
        } catch (error) {
            console.error('Failed to fetch item:', error);
            reply.code(500);
            return { ok: false, error: 'Failed to fetch item' };
        }
    });

    // Mark item as read/unread
    fastify.post('/items/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const result = MarkReadSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const isRead = result.data.read ? 1 : 0;
        const readAt = result.data.read ? new Date().toISOString() : null;

        try {
            const stmt = db.prepare('UPDATE items SET is_read = ?, read_at = ? WHERE id = ?');
            const runResult = stmt.run(isRead, readAt, id);

            if (runResult.changes === 0) {
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
    fastify.post('/items/mark-all-read', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = MarkAllReadSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const { feedUrl, source, before } = result.data;

        // Validate source if provided
        if (source && !['generic', 'youtube', 'reddit', 'podcast'].includes(source)) {
            reply.code(400);
            return {
                ok: false,
                error: 'Invalid source. Must be: generic, youtube, reddit, or podcast'
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
            const now = new Date().toISOString();
            const query = `UPDATE items SET is_read = 1, read_at = ? WHERE ${whereClause}`;

            const stmt = db.prepare(query);
            const runResult = stmt.run(now, ...params);

            return {
                ok: true,
                updated: runResult.changes
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
    fastify.post('/items/:id/star', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const result = StarItemSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const isStarred = result.data.starred ? 1 : 0;

        try {
            const stmt = db.prepare('UPDATE items SET is_starred = ? WHERE id = ?');
            const runResult = stmt.run(isStarred, id);

            if (runResult.changes === 0) {
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
            fastify.log.error({ error, id, isStarred }, 'Failed to update item star status');
            reply.code(500);
            return {
                ok: false,
                error: 'Failed to update bookmark status in database'
            };
        }
    });

    fastify.patch('/items/:id/playback-position', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const result = PlaybackPositionSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return { ok: false, error: result.error.issues[0].message };
        }

        try {
            const runResult = db.prepare('UPDATE items SET playback_position = ? WHERE id = ?').run(result.data.position, id);
            if (runResult.changes === 0) {
                reply.code(404);
                return { ok: false, error: 'Item not found' };
            }
            return { ok: true, playback_position: result.data.position };
        } catch (error: any) {
            fastify.log.error({ error, id, position: result.data.position }, 'Failed to update playback position');
            reply.code(500);
            return { ok: false, error: 'Failed to update playback position in database' };
        }
    });

    // Delete a single item
    fastify.delete('/items/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };

        try {
            const result = db.prepare('DELETE FROM items WHERE id = ?').run(id);
            if (result.changes === 0) {
                reply.code(404);
                return { ok: false, error: 'Item not found' };
            }
            fastify.log.info(`Deleted item: ${id}`);
            return { ok: true, deleted: id };
        } catch (error: any) {
            fastify.log.error({ error, id }, 'Failed to delete item');
            reply.code(500);
            return { ok: false, error: 'Failed to delete item from database' };
        }
    });

    // Purge old items (respects bookmarks)
    fastify.post('/items/purge', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            // Get the purge retention setting from meta table
            const retentionSetting = db.prepare("SELECT value FROM meta WHERE key = 'purge_retention'").get() as { value: string } | undefined;
            const retentionDays = retentionSetting?.value || 'never';

            if (retentionDays === 'never') {
                return { ok: true, deleted: 0, message: 'Purge retention is set to never' };
            }

            const days = parseInt(retentionDays, 10);
            if (isNaN(days) || days <= 0) {
                reply.code(400);
                return { ok: false, error: 'Invalid retention setting' };
            }

            // Calculate cutoff date
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);
            const cutoffIso = cutoffDate.toISOString();

            // Delete old read items that are NOT bookmarked
            const result = db.prepare(`
                DELETE FROM items
                WHERE is_read = 1
                  AND is_starred = 0
                  AND COALESCE(published, created_at) < ?
            `).run(cutoffIso);

            fastify.log.info({ deleted: result.changes, cutoffDate: cutoffIso, retentionDays: days }, 'Purged old items');

            return {
                ok: true,
                deleted: result.changes,
                cutoffDate: cutoffIso,
                retentionDays: days
            };
        } catch (error: any) {
            fastify.log.error({ error }, 'Failed to purge items');
            reply.code(500);
            return { ok: false, error: 'Failed to purge items from database' };
        }
    });
}
