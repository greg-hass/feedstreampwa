import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { 
  validateToggleItemReadBody, 
  validateToggleItemStarBody, 
  validateUpdatePlaybackPositionBody,
  validateMarkAllReadBody 
} from '../utils/validators.js';

export async function itemRoutes(fastify: FastifyInstance) {
  // GET /api/items - List all items (with optional filters)
  fastify.get('/items', async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    const db = getDatabase();
    const queryParams = request.query as { feedUrl?: string; read?: string; starred?: string; smartFolder?: string; limit?: string; offset?: string };
    const { feedUrl, read, starred, smartFolder, limit = 50, offset = 0 } = queryParams;

    let sqlQuery = `
      SELECT i.*, f.title as feed_title, f.kind as feed_kind
      FROM items i
      JOIN feeds f ON i.feed_url = f.url
      WHERE 1=1
    `;
    const params: any[] = [];

    if (feedUrl) {
      sqlQuery += ' AND i.feed_url = ?';
      params.push(decodeURIComponent(feedUrl));
    }

    if (read !== undefined) {
      sqlQuery += ' AND i.is_read = ?';
      params.push(read === 'true' ? 1 : 0);
    }

    if (starred !== undefined) {
      sqlQuery += ' AND i.is_starred = ?';
      params.push(starred === 'true' ? 1 : 0);
    }

    if (smartFolder) {
      // Map smart folder names to feed kinds
      // 'rss' smart folder should show 'generic' feeds
      const kindMapping: Record<string, string> = {
        'rss': 'generic',
        'youtube': 'youtube',
        'reddit': 'reddit',
        'podcast': 'podcast'
      };
      const kind = kindMapping[smartFolder];
      if (kind) {
        sqlQuery += ' AND f.kind = ?';
        params.push(kind);
      }
    }

    sqlQuery += ' ORDER BY i.published DESC LIMIT ? OFFSET ?';
    params.push(parseInt(String(limit), 10) || 50, parseInt(String(offset), 10) || 0);

    const items = db.prepare(sqlQuery).all(...params);

    return { ok: true, items };
  });

  // GET /api/items/:id - Get a specific item
  fastify.get('/items/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Item ID is required' });
    }

    const db = getDatabase();
    const item = db.prepare(`
      SELECT i.*, f.title as feed_title, f.kind as feed_kind
      FROM items i
      JOIN feeds f ON i.feed_url = f.url
      WHERE i.id = ?
    `).get(request.params.id);

    if (!item) {
      return reply.code(404).send({ ok: false, error: 'Item not found' });
    }

    return { ok: true, item };
  });

  // PATCH /api/items/:id/read - Toggle read status
  fastify.patch('/items/:id/read', async (request: FastifyRequest<{ Params: { id: string }, Body: any }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Item ID is required' });
    }

    try {
      const validated = validateToggleItemReadBody(request.body);
      const db = getDatabase();

      const result = db.prepare('UPDATE items SET is_read = ? WHERE id = ?')
        .run(validated.read ? 1 : 0, request.params.id);

      if (result.changes === 0) {
        return reply.code(404).send({ ok: false, error: 'Item not found' });
      }

      return { ok: true, updated: result.changes };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // PATCH /api/items/:id/star - Toggle star status
  fastify.patch('/items/:id/star', async (request: FastifyRequest<{ Params: { id: string }, Body: any }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Item ID is required' });
    }

    try {
      const validated = validateToggleItemStarBody(request.body);
      const db = getDatabase();

      const result = db.prepare('UPDATE items SET is_starred = ? WHERE id = ?')
        .run(validated.starred ? 1 : 0, request.params.id);

      if (result.changes === 0) {
        return reply.code(404).send({ ok: false, error: 'Item not found' });
      }

      return { ok: true, updated: result.changes };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // PATCH /api/items/:id/playback - Update playback position
  fastify.patch('/items/:id/playback', async (request: FastifyRequest<{ Params: { id: string }, Body: any }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Item ID is required' });
    }

    try {
      const validated = validateUpdatePlaybackPositionBody(request.body);
      const db = getDatabase();

      const result = db.prepare('UPDATE items SET playback_position = ? WHERE id = ?')
        .run(validated.position, request.params.id);

      if (result.changes === 0) {
        return reply.code(404).send({ ok: false, error: 'Item not found' });
      }

      return { ok: true, updated: result.changes };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // POST /api/items/mark-all-read - Mark all items as read
  fastify.post('/items/mark-all-read', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const validated = validateMarkAllReadBody(request.body);
      const db = getDatabase();

      let sqlQuery = 'UPDATE items SET is_read = 1 WHERE is_read = 0';
      const params: any[] = [];

      if (validated.feedUrl) {
        sqlQuery += ' AND feed_url = ?';
        params.push(decodeURIComponent(validated.feedUrl));
      }

      if (validated.source) {
        sqlQuery += ' AND source = ?';
        params.push(validated.source);
      }

      if (validated.before) {
        sqlQuery += ' AND published < ?';
        params.push(validated.before);
      }

      const result = db.prepare(sqlQuery).run(...params);

      return { ok: true, marked: result.changes };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // GET /api/items/stats - Get item statistics
  fastify.get('/items/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();

    const totalItems = db.prepare('SELECT COUNT(*) as count FROM items').get() as any;
    const unreadItems = db.prepare('SELECT COUNT(*) as count FROM items WHERE is_read = 0').get() as any;
    const starredItems = db.prepare('SELECT COUNT(*) as count FROM items WHERE is_starred = 1').get() as any;
    const itemsByFeed = db.prepare(`
      SELECT f.title, COUNT(*) as count
      FROM items i
      JOIN feeds f ON i.feed_url = f.url
      GROUP BY f.url
      ORDER BY count DESC
      LIMIT 10
    `).all();

    return {
      ok: true,
      stats: {
        totalItems: totalItems.count,
        unreadItems: unreadItems.count,
        starredItems: starredItems.count,
        itemsByFeed
      }
    };
  });
}
