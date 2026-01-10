import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { validateSearchParams } from '../utils/validators.js';

export async function searchRoutes(fastify: FastifyInstance) {
  // GET /api/search - Search items
  fastify.get('/search', async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    try {
      const validated = validateSearchParams(request.query);
      const db = getDatabase();
      const { q, limit, offset } = validated;

      // Use FTS5 search
      const items = db.prepare(`
        SELECT i.*, f.title as feed_title, f.kind as feed_kind, rank
        FROM items i
        JOIN feeds f ON i.feed_id = f.id
        JOIN items_fts ON i.id = items_fts.rowid
        WHERE items_fts MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `).all(q, limit, offset);

      return { ok: true, items, query: q };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Search failed' });
    }
  });

  // GET /api/search/feeds - Search feeds
  fastify.get('/search/feeds', async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    const db = getDatabase();
    const query = request.query as { q?: string; limit?: string; offset?: string };
    const { q, limit = 50, offset = 0 } = query;

    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Search query is required' });
    }

    const searchTerm = `%${q.trim()}%`;
    const limitNum = parseInt(String(limit), 10) || 50;
    const offsetNum = parseInt(String(offset), 10) || 0;

    const feeds = db.prepare(`
      SELECT f.*,
        COUNT(DISTINCT i.id) as unreadCount
      FROM feeds f
      LEFT JOIN items i ON i.feed_id = f.id AND i.read = 0
      WHERE f.title LIKE ? OR f.site_url LIKE ? OR f.url LIKE ?
      GROUP BY f.id
      ORDER BY f.title
      LIMIT ? OFFSET ?
    `).all(searchTerm, searchTerm, searchTerm, limitNum, offsetNum);

    return { ok: true, feeds, query: q.trim() };
  });
}
