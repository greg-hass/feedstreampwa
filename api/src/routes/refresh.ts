import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';

export async function refreshRoutes(fastify: FastifyInstance) {
  // GET /api/refresh - Get refresh status
  fastify.get('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();

    // Get total feeds and recently checked feeds
    const totalFeeds = db.prepare('SELECT COUNT(*) as count FROM feeds').get() as any;
    const recentFeeds = db.prepare(`
      SELECT url, title, last_checked, last_status
      FROM feeds
      ORDER BY last_checked DESC
      LIMIT 10
    `).all();

    return {
      ok: true,
      status: {
        totalFeeds: totalFeeds.count,
        recentFeeds,
        activeCount: 0
      }
    };
  });

  // POST /api/refresh/start - Trigger refresh for specific feeds
  fastify.post('/refresh/start', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const db = getDatabase();
    const body = request.body as { urls?: string[] } | undefined;
    const { urls } = body || {};

    // Validate input
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return reply.code(400).send({ ok: false, error: 'URLs array is required' });
    }

    // Mark feeds for refresh
    let refreshedCount = 0;
    for (const url of urls) {
      const result = db.prepare('UPDATE feeds SET last_checked = NULL WHERE url = ?').run(url);
      refreshedCount += result.changes;
    }

    return { ok: true, message: `Refresh queued for ${refreshedCount} feed(s)` };
  });

  // POST /api/refresh - Trigger a refresh
  fastify.post('/refresh', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const db = getDatabase();
    const body = request.body as { feedId?: string; feedUrl?: string } | undefined;
    const { feedId, feedUrl } = body || {};

    // Validate input
    if (!feedId && !feedUrl) {
      return reply.code(400).send({ ok: false, error: 'Either feedId or feedUrl is required' });
    }

    // Find feed
    let feed;
    if (feedId) {
      feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(feedId);
    } else if (feedUrl) {
      feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(feedUrl);
    }

    if (!feed) {
      return reply.code(404).send({ ok: false, error: 'Feed not found' });
    }

    // Mark feed for refresh
    db.prepare('UPDATE feeds SET last_checked = NULL WHERE url = ?').run((feed as any).url);

    return { ok: true, message: 'Refresh queued' };
  });

  // POST /api/refresh/all - Trigger refresh for all feeds
  fastify.post('/refresh/all', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();

    // Mark all feeds for refresh
    const result = db.prepare('UPDATE feeds SET last_checked = NULL').run();

    return { ok: true, message: `Refresh queued for ${result.changes} feed(s)` };
  });

  // GET /api/refresh/status - Get refresh status
  fastify.get('/refresh/status', async (request: FastifyRequest<{ Querystring: { jobId?: string } }>, reply: FastifyReply) => {
    const db = getDatabase();
    const { jobId } = request.query || {};

    if (jobId) {
      // Return status for a specific job (simplified - just return feed status)
      return {
        ok: true,
        status: {
          id: jobId,
          status: 'completed',
          message: 'Refresh completed'
        }
      };
    }

    // Return overall refresh status
    const totalFeeds = db.prepare('SELECT COUNT(*) as count FROM feeds').get() as any;
    const pendingFeeds = db.prepare('SELECT COUNT(*) as count FROM feeds WHERE last_checked IS NULL').get() as any;

    return {
      ok: true,
      status: {
        total: totalFeeds.count,
        pending: pendingFeeds.count,
        completed: totalFeeds.count - pendingFeeds.count
      }
    };
  });
}
