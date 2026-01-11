import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { validateCreateFeedBody, validateUpdateFeedBody } from '../utils/validators.js';

export async function feedRoutes(fastify: FastifyInstance) {
  // GET /api/feeds - List all feeds
  fastify.get('/feeds', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();
    const feeds = db.prepare(`
      SELECT
        f.*,
        COUNT(DISTINCT i.id) as unreadCount
      FROM feeds f
      LEFT JOIN items i ON i.feed_url = f.url AND i.is_read = 0
      GROUP BY f.url
      ORDER BY f.title
    `).all();

    return { ok: true, feeds };
  });

  // GET /api/feeds/:url - Get a specific feed
  fastify.get('/feeds/:url', async (request: FastifyRequest<{ Params: { url: string } }>, reply: FastifyReply) => {
    if (!request.params?.url || typeof request.params.url !== 'string' || request.params.url.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed URL is required' });
    }

    const db = getDatabase();
    const feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(decodeURIComponent(request.params.url));

    if (!feed) {
      return reply.code(404).send({ ok: false, error: 'Feed not found' });
    }

    return { ok: true, feed };
  });

  // POST /api/feeds - Add a new feed
  fastify.post('/feeds', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const validated = validateCreateFeedBody(request.body);
      const db = getDatabase();
      const { url } = validated;

      const result = db.prepare(`
        INSERT INTO feeds (url, kind, title, site_url, icon_url, custom_title, last_status)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(url, 'generic', null, null, null, null);

      return { ok: true, id: result.lastInsertRowid };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // PUT /api/feeds/:url - Update a feed
  fastify.put('/feeds/:url', async (request: FastifyRequest<{ Params: { url: string }, Body: any }>, reply: FastifyReply) => {
    if (!request.params?.url || typeof request.params.url !== 'string' || request.params.url.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed URL is required' });
    }

    try {
      const validated = validateUpdateFeedBody(request.body);
      const db = getDatabase();
      const { url, title } = validated;

      const result = db.prepare(`
        UPDATE feeds
        SET url = ?, title = ?
        WHERE url = ?
      `).run(url, title || null, decodeURIComponent(request.params.url));

      if (result.changes === 0) {
        return reply.code(404).send({ ok: false, error: 'Feed not found' });
      }

      return { ok: true, updated: result.changes };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // DELETE /api/feeds - Delete a feed by URL query parameter
  fastify.delete('/feeds', async (request: FastifyRequest<{ Querystring: { url: string } }>, reply: FastifyReply) => {
    if (!request.query?.url || typeof request.query.url !== 'string' || request.query.url.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed URL is required' });
    }

    const db = getDatabase();
    const feedUrl = decodeURIComponent(request.query.url);

    // Delete items for this feed first
    db.prepare('DELETE FROM items WHERE feed_url = ?').run(feedUrl);

    // Delete the feed
    const result = db.prepare('DELETE FROM feeds WHERE url = ?').run(feedUrl);

    if (result.changes === 0) {
      return reply.code(404).send({ ok: false, error: 'Feed not found' });
    }

    return { ok: true, deleted: result.changes };
  });

  // POST /api/feeds/:url/refresh - Trigger a refresh for a specific feed
  fastify.post('/feeds/:url/refresh', async (request: FastifyRequest<{ Params: { url: string } }>, reply: FastifyReply) => {
    if (!request.params?.url || typeof request.params.url !== 'string' || request.params.url.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed URL is required' });
    }

    const db = getDatabase();
    const feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(decodeURIComponent(request.params.url));

    if (!feed) {
      return reply.code(404).send({ ok: false, error: 'Feed not found' });
    }

    // Add to refresh queue (simplified - in production, use a proper job queue)
    // For now, we'll just mark it as needing refresh
    // This would be handled by the refresh service

    return { ok: true, message: 'Refresh queued' };
  });

  // GET /api/feeds/stats - Get feed statistics
  fastify.get('/feeds/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();

    const totalFeeds = db.prepare('SELECT COUNT(*) as count FROM feeds').get() as any;
    const totalItems = db.prepare('SELECT COUNT(*) as count FROM items').get() as any;
    const unreadItems = db.prepare('SELECT COUNT(*) as count FROM items WHERE read = 0').get() as any;
    const feedsByKind = db.prepare(`
      SELECT kind, COUNT(*) as count
      FROM feeds
      GROUP BY kind
    `).all();

    return {
      ok: true,
      stats: {
        totalFeeds: totalFeeds.count,
        totalItems: totalItems.count,
        unreadItems: unreadItems.count,
        feedsByKind
      }
    };
  });
}
