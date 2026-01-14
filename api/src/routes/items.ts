import { db } from '../db/client.js';

export default async function itemRoutes(fastify: any, options: any) {
    // Get items endpoint
    fastify.get('/items', async (request: any, reply: any) => {
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
        const q = query.q ? query.q.trim() : null;

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

        if (q) {
            conditions.push('fts MATCH ?');
            params.push(q);
        }

        // Need to join feeds table if filtering by smartFolder
        const baseFromClause = 'FROM items i INNER JOIN feeds f ON i.feed_url = f.url';
        const fromClause = q 
            ? `${baseFromClause} INNER JOIN items_fts fts ON i.rowid = fts.rowid`
            : baseFromClause;
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
                i.external_id, i.raw_guid, i.created_at, i.is_read, i.is_starred, i.playback_position, i.read_at,
                i.enclosure,
                f.icon_url as feed_icon_url, COALESCE(f.custom_title, f.title) as feed_title
            ${fromClause}
            ${whereClause}
            ORDER BY 
                CASE WHEN i.published IS NOT NULL THEN i.published ELSE i.created_at END DESC
            LIMIT ? OFFSET ?
        `;

        const rawItems = db.prepare(itemsQuery).all(...params, limit, offset);

        const items = rawItems.map((item: any) => {
            if (item.enclosure && typeof item.enclosure === 'string') {
                try {
                    item.enclosure = JSON.parse(item.enclosure);
                } catch {
                    item.enclosure = null;
                }
            }
            return item;
        });

        return {
            ok: true,
            total,
            items
        };
    });

    // Mark item as read/unread
    fastify.post('/items/:id/read', async (request: any, reply: any) => {
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
        const readAt = body.read ? new Date().toISOString() : null;

        try {
            const stmt = db.prepare('UPDATE items SET is_read = ?, read_at = ? WHERE id = ?');
            const result = stmt.run(isRead, readAt, id);

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
    fastify.post('/items/mark-all-read', async (request: any, reply: any) => {
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
            const result = stmt.run(now, ...params);

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
    fastify.post('/items/:id/star', async (request: any, reply: any) => {
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

    fastify.patch('/items/:id/playback-position', async (request: any, reply: any) => {
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

    // Delete a single item
    fastify.delete('/items/:id', async (request: any, reply: any) => {
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
            fastify.log.error(error);
            reply.code(500);
            return { ok: false, error: 'Database error' };
        }
    });
}
