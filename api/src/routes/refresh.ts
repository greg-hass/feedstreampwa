import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';

export async function refreshRoutes(fastify: FastifyInstance) {
  // GET /api/refresh - Get refresh status
  fastify.get('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();

    // Get active refresh jobs
    const activeJobs = db.prepare(`
      SELECT * FROM refresh_jobs
      WHERE status = 'pending' OR status = 'running'
      ORDER BY created_at DESC
    `).all();

    // Get recent completed jobs
    const recentJobs = db.prepare(`
      SELECT * FROM refresh_jobs
      WHERE status = 'completed' OR status = 'failed'
      ORDER BY completed_at DESC
      LIMIT 10
    `).all();

    return {
      ok: true,
      status: {
        activeJobs,
        recentJobs,
        activeCount: activeJobs.length
      }
    };
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

    // Find the feed
    let feed;
    if (feedId) {
      feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(feedId);
    } else if (feedUrl) {
      feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(feedUrl);
    }

    if (!feed) {
      return reply.code(404).send({ ok: false, error: 'Feed not found' });
    }

    // Check if there's already a pending/running job for this feed
    const existingJob = db.prepare(`
      SELECT * FROM refresh_jobs
      WHERE feed_id = ? AND (status = 'pending' OR status = 'running')
    `).get((feed as any).id);

    if (existingJob) {
      return { ok: true, message: 'Refresh already queued', jobId: (existingJob as any).id };
    }

    // Create a new refresh job
    const result = db.prepare(`
      INSERT INTO refresh_jobs (feed_id, status, created_at)
      VALUES (?, 'pending', datetime('now'))
    `).run((feed as any).id);

    return { ok: true, message: 'Refresh queued', jobId: result.lastInsertRowid };
  });

  // POST /api/refresh/all - Trigger refresh for all feeds
  fastify.post('/refresh/all', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();

    // Get all feeds
    const feeds = db.prepare('SELECT * FROM feeds').all();

    // Queue refresh jobs for all feeds
    const jobIds: number[] = [];
    for (const feed of feeds) {
      // Check if there's already a pending/running job
      const existingJob = db.prepare(`
        SELECT * FROM refresh_jobs
        WHERE feed_id = ? AND (status = 'pending' OR status = 'running')
      `).get((feed as any).id);

      if (!existingJob) {
        const result = db.prepare(`
          INSERT INTO refresh_jobs (feed_id, status, created_at)
          VALUES (?, 'pending', datetime('now'))
        `).run((feed as any).id);
        jobIds.push(result.lastInsertRowid as number);
      }
    }

    return { ok: true, message: `Queued ${jobIds.length} refresh jobs`, jobIds };
  });

  // GET /api/refresh/:id - Get refresh job status
  fastify.get('/refresh/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Job ID is required' });
    }

    const db = getDatabase();
    const job = db.prepare('SELECT * FROM refresh_jobs WHERE id = ?').get(request.params.id);

    if (!job) {
      return reply.code(404).send({ ok: false, error: 'Job not found' });
    }

    return { ok: true, job };
  });

  // DELETE /api/refresh/:id - Cancel a refresh job
  fastify.delete('/refresh/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Job ID is required' });
    }

    const db = getDatabase();

    // Only allow cancelling pending jobs
    const job = db.prepare('SELECT * FROM refresh_jobs WHERE id = ?').get(request.params.id);

    if (!job) {
      return reply.code(404).send({ ok: false, error: 'Job not found' });
    }

    if ((job as any).status !== 'pending') {
      return reply.code(400).send({ ok: false, error: 'Cannot cancel a running or completed job' });
    }

    const result = db.prepare('UPDATE refresh_jobs SET status = "cancelled", completed_at = datetime("now") WHERE id = ?')
      .run(request.params.id);

    return { ok: true, cancelled: result.changes };
  });

  // DELETE /api/refresh - Clear completed jobs
  fastify.delete('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();
    const { status } = request.query as { status?: string };

    let query = 'DELETE FROM refresh_jobs WHERE status IN (?, ?)';
    const params: any[] = ['completed', 'failed'];

    if (status === 'all') {
      query = 'DELETE FROM refresh_jobs';
    } else if (status === 'completed') {
      query = 'DELETE FROM refresh_jobs WHERE status = ?';
      params.length = 0;
      params.push('completed');
    } else if (status === 'failed') {
      query = 'DELETE FROM refresh_jobs WHERE status = ?';
      params.length = 0;
      params.push('failed');
    }

    const result = db.prepare(query).run(...params);

    return { ok: true, deleted: result.changes };
  });
}
