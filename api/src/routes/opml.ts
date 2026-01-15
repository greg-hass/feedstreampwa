import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createImportJob, getJobStatus } from '../services/import-service.js';
import { generateOpml } from '../services/backup-service.js';
import { authenticateToken } from '../middleware/auth.js';
import { z } from 'zod';

const ImportOpmlSchema = z.object({
    opml: z.string().min(1)
});

export default async function opmlRoutes(fastify: FastifyInstance, options: any) {
    // Import OPML
    fastify.post('/opml', {
    }, async (request: FastifyRequest, reply: FastifyReply) => {
        const result = ImportOpmlSchema.safeParse(request.body);
        if (!result.success) {
            reply.code(400);
            return { ok: false, error: result.error.issues[0].message };
        }

        try {
            const jobId = createImportJob(result.data.opml);
            return { ok: true, jobId };
        } catch (e: any) {
            fastify.log.error(e);
            reply.code(500);
            return { ok: false, error: e.message || 'Failed to start import' };
        }
    });

    // Get Import Status
    fastify.get('/opml/status/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const status = getJobStatus(id);

        if (!status) {
            reply.code(404);
            return { ok: false, error: 'Job not found' };
        }

        return { ok: true, status };
    });

    // Export OPML
    fastify.get('/opml/export', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const opml = generateOpml();
            reply.header('Content-Type', 'application/xml');
            reply.header('Content-Disposition', `attachment; filename="feedstream-${new Date().toISOString().split('T')[0]}.opml"`);
            return opml;
        } catch (e: any) {
            fastify.log.error(e);
            reply.code(500);
            return { ok: false, error: 'Failed to generate OPML' };
        }
    });
}
