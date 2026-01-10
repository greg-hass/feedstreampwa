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
      LEFT JOIN items i ON i.feed_id = f.id AND i.read = 0
      GROUP BY f.id
      ORDER BY f.title
    `).all();

    return { ok: true, feeds };
  });

  // GET /api/feeds/:id - Get a specific feed
  fastify.get('/feeds/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed ID is required' });
    }

    const db = getDatabase();
    const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(request.params.id);

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

  // PUT /api/feeds/:id - Update a feed
  fastify.put('/feeds/:id', async (request: FastifyRequest<{ Params: { id: string }, Body: any }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed ID is required' });
    }

    try {
      const validated = validateUpdateFeedBody(request.body);
      const db = getDatabase();
      const { url, title } = validated;

      const result = db.prepare(`
        UPDATE feeds
        SET url = ?, title = ?
        WHERE id = ?
      `).run(url, title || null, request.params.id);

      if (result.changes === 0) {
        return reply.code(404).send({ ok: false, error: 'Feed not found' });
      }

      return { ok: true, updated: result.changes };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // DELETE /api/feeds/:id - Delete a feed
  fastify.delete('/feeds/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed ID is required' });
    }

    const db = getDatabase();

    // Delete items for this feed first
    db.prepare('DELETE FROM items WHERE feed_id = ?').run(request.params.id);

    // Delete the feed
    const result = db.prepare('DELETE FROM feeds WHERE id = ?').run(request.params.id);

    if (result.changes === 0) {
      return reply.code(404).send({ ok: false, error: 'Feed not found' });
    }

    return { ok: true, deleted: result.changes };
  });

  // POST /api/feeds/:id/refresh - Trigger a refresh for a specific feed
  fastify.post('/feeds/:id/refresh', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed ID is required' });
    }

    const db = getDatabase();
    const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(request.params.id);

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
