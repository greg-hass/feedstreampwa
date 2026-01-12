import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { validateImportOpmlBody } from '../utils/validators.js';
import { createImportJob, getJobStatus } from '../services/import-service.js';

const APOS_ENTITY = String.fromCharCode(38) + '#39;';

export async function opmlRoutes(fastify: FastifyInstance) {
  // GET /export - Export feeds as OPML
  fastify.get('/export', async (request: FastifyRequest, reply: FastifyReply) => {
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
    reply.header('Content-Disposition', `attachment; filename="feedstream-export-${new Date().toISOString().split('T')[0]}.opml"`);
    return opml;
  });

  // POST / - Import feeds from OPML (Async)
  fastify.post('/', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const validated = validateImportOpmlBody(request.body);
      const { opml } = validated;

      const jobId = createImportJob(opml);

      return { ok: true, jobId, message: 'Import started' };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Import failed' });
    }
  });

  // GET /status/:id - Check import status
  fastify.get('/status/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const status = getJobStatus(request.params.id);
    
    if (!status) {
      return reply.code(404).send({ ok: false, error: 'Job not found' });
    }

    return { ok: true, status };
  });
}

// Helper: Escape XML special characters
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
