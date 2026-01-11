import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { validateImportOpmlBody } from '../utils/validators.js';
import { createImportJob, getJobStatus } from '../services/import-service.js';

const APOS_ENTITY = String.fromCharCode(38) + '#39;';

export async function opmlRoutes(fastify: FastifyInstance) {
  // GET /api/opml - Export feeds as OPML
  fastify.get('/opml', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();

    // Get all feeds
    const feeds = db.prepare('SELECT * FROM feeds ORDER BY title').all();

    // Build OPML XML
    const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>FeedStream Subscriptions</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
${(feeds as any[]).map(feed => `    <outline type="rss" text="${escapeXml(feed.title || feed.url)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.site_url || '')}" />`).join('\n')}
  </body>
</opml>`;

    reply.type('application/xml; charset=utf-8');
    return opml;
  });

  // POST /api/opml - Import feeds from OPML (Async)
  fastify.post('/opml', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const validated = validateImportOpmlBody(request.body);
      const { opml } = validated;

      const jobId = createImportJob(opml);

      return { ok: true, jobId, message: 'Import started' };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Import failed' });
    }
  });

  // GET /api/opml/status/:id - Check import status
  fastify.get('/opml/status/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const status = getJobStatus(request.params.id);
    
    if (!status) {
      return reply.code(404).send({ ok: false, error: 'Job not found' });
    }

    return { ok: true, status };
  });
}

// Helper: Escape XML special characters
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, APOS_ENTITY);
}
