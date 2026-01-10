import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';

export async function readerRoutes(fastify: FastifyInstance) {
  // GET /api/reader/:id - Get article content for reader view
  fastify.get('/reader/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Item ID is required' });
    }

    const db = getDatabase();
    const item = db.prepare(`
      SELECT i.*, f.title as feed_title, f.kind as feed_kind
      FROM items i
      JOIN feeds f ON i.feed_id = f.id
      WHERE i.id = ?
    `).get(request.params.id);

    if (!item) {
      return reply.code(404).send({ ok: false, error: 'Item not found' });
    }

    return { ok: true, item };
  });

  // GET /api/reader/:id/cache - Get cached article content
  fastify.get('/reader/:id/cache', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Item ID is required' });
    }

    const db = getDatabase();
    const cache = db.prepare('SELECT * FROM reader_cache WHERE item_id = ?').get(request.params.id);

    if (!cache) {
      return reply.code(404).send({ ok: false, error: 'Cached content not found' });
    }

    // Check if cache is expired
    const cachedAt = new Date((cache as any).cached_at);
    const now = new Date();
    const hoursDiff = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 168) { // 7 days
      return reply.code(404).send({ ok: false, error: 'Cached content expired' });
    }

    return { ok: true, content: (cache as any).content };
  });

  // PUT /api/reader/:id/cache - Cache article content
  fastify.put('/reader/:id/cache', async (request: FastifyRequest<{ Params: { id: string }, Body: any }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Item ID is required' });
    }

    if (!request.body || typeof (request.body as any).content !== 'string') {
      return reply.code(400).send({ ok: false, error: 'Content is required' });
    }

    const db = getDatabase();
    const { content } = request.body as { content: string };

    // Check if item exists
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(request.params.id);
    if (!item) {
      return reply.code(404).send({ ok: false, error: 'Item not found' });
    }

    // Insert or update cache
    db.prepare(`
      INSERT INTO reader_cache (item_id, content, cached_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(item_id) DO UPDATE SET content = ?, cached_at = datetime('now')
    `).run(request.params.id, content, content);

    return { ok: true, message: 'Content cached' };
  });

  // DELETE /api/reader/:id/cache - Delete cached article content
  fastify.delete('/reader/:id/cache', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Item ID is required' });
    }

    const db = getDatabase();
    const result = db.prepare('DELETE FROM reader_cache WHERE item_id = ?').run(request.params.id);

    return { ok: true, deleted: result.changes };
  });

  // DELETE /api/reader/cache - Clear all cached content
  fastify.delete('/reader/cache', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();
    const result = db.prepare('DELETE FROM reader_cache').run();

    return { ok: true, deleted: result.changes };
  });
}
