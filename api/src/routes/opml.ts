import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { validateImportOpmlBody } from '../utils/validators.js';

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

  // POST /api/opml - Import feeds from OPML
  fastify.post('/opml', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const validated = validateImportOpmlBody(request.body);
      const db = getDatabase();
      const { opml } = validated;

      // Parse OPML (simplified parser)
      const urls = parseOpmlUrls(opml);

      if (urls.length === 0) {
        return reply.code(400).send({ ok: false, error: 'No feeds found in OPML' });
      }

      // Import feeds
      let imported = 0;
      let skipped = 0;

      for (const url of urls) {
        // Check if feed already exists
        const existing = db.prepare('SELECT * FROM feeds WHERE url = ?').get(url);

        if (!existing) {
          db.prepare(`
            INSERT INTO feeds (url, kind, title, site_url, icon_url, custom_title, last_status)
            VALUES (?, 'generic', NULL, NULL, NULL, NULL, 0)
          `).run(url);
          imported++;
        } else {
          skipped++;
        }
      }

      return {
        ok: true,
        imported,
        skipped,
        total: urls.length
      };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Import failed' });
    }
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

// Helper: Parse OPML and extract feed URLs
function parseOpmlUrls(opml: string): string[] {
  const urls: string[] = [];

  // Simple regex-based parser (for production, use a proper XML parser)
  const urlRegex = /xmlUrl\s*=\s*["']([^"']+)["']/gi;
  let match;

  while ((match = urlRegex.exec(opml)) !== null) {
    const url = match[1];
    if (url && url.startsWith('http')) {
      urls.push(url);
    }
  }

  return [...new Set(urls)]; // Remove duplicates
}
