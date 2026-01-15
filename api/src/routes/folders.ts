import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { 
    CreateFolderSchema, 
    UpdateFolderSchema, 
    FolderFeedSchema 
} from '../types/schemas.js';

export default async function folderRoutes(fastify: FastifyInstance, options: any) {
    // Get all custom folders with feed counts
    fastify.get('/folders', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const folders = db.prepare(`
                SELECT 
                    f.id,
                    f.name,
                    f.created_at,
                    COUNT(ff.feed_url) as feedCount
                FROM folders f
                LEFT JOIN folder_feeds ff ON f.id = ff.folder_id
                GROUP BY f.id
                ORDER BY f.name ASC
            `).all();

            return {
                ok: true,
                folders
            };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: 'Database error'
            };
        }
    });

    // Create a new custom folder
    fastify.post('/folders', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = CreateFolderSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const { name } = result.data;

        try {
            const id = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const created_at = new Date().toISOString();

            db.prepare(`
                INSERT INTO folders (id, name, created_at)
                VALUES (?, ?, ?)
            `).run(id, name, created_at);

            return {
                ok: true,
                folder: { id, name, created_at }
            };
        } catch (error: any) {
            if (error.message?.includes('UNIQUE constraint')) {
                reply.code(409);
                return {
                    ok: false,
                    error: 'A folder with this name already exists'
                };
            }
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: 'Database error'
            };
        }
    });

    // Rename a custom folder
    fastify.patch('/folders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const result = UpdateFolderSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        try {
            const updateResult = db.prepare(`
                UPDATE folders SET name = ? WHERE id = ?
            `).run(result.data.name, id);

            if (updateResult.changes === 0) {
                reply.code(404);
                return {
                    ok: false,
                    error: 'Folder not found'
                };
            }

            return { ok: true };
        } catch (error: any) {
            if (error.message?.includes('UNIQUE constraint')) {
                reply.code(409);
                return {
                    ok: false,
                    error: 'A folder with this name already exists'
                };
            }
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: 'Database error'
            };
        }
    });

    // Delete a custom folder
    fastify.delete('/folders/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };

        try {
            // Count associations before deletion
            const associations = db.prepare(`
                SELECT COUNT(*) as count FROM folder_feeds WHERE folder_id = ?
            `).get(id) as any;

            // Delete folder (CASCADE will delete associations)
            const deleteResult = db.prepare(`
                DELETE FROM folders WHERE id = ?
            `).run(id);

            if (deleteResult.changes === 0) {
                reply.code(404);
                return {
                    ok: false,
                    error: 'Folder not found'
                };
            }

            return {
                ok: true,
                removedAssociations: associations.count
            };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: 'Database error'
            };
        }
    });

    // Add feed to custom folder
    fastify.post('/folders/:id/feeds', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const result = FolderFeedSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const { feedUrl } = result.data;

        try {
            // Verify folder exists
            const folder = db.prepare('SELECT id FROM folders WHERE id = ?').get(id);
            if (!folder) {
                reply.code(404);
                return {
                    ok: false,
                    error: 'Folder not found'
                };
            }

            // Verify feed exists
            const feed = db.prepare('SELECT url FROM feeds WHERE url = ?').get(feedUrl);
            if (!feed) {
                reply.code(404);
                return {
                    ok: false,
                    error: 'Feed not found'
                };
            }

            // Insert association (ignore if exists)
            const created_at = new Date().toISOString();
            db.prepare(`
                INSERT OR IGNORE INTO folder_feeds (folder_id, feed_url, created_at)
                VALUES (?, ?, ?)
            `).run(id, feedUrl, created_at);

            return { ok: true };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: 'Database error'
            };
        }
    });

    // Remove feed from custom folder
    fastify.delete('/folders/:id/feeds', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        const result = FolderFeedSchema.safeParse(request.body);

        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        try {
            const deleteResult = db.prepare(`
                DELETE FROM folder_feeds WHERE folder_id = ? AND feed_url = ?
            `).run(id, result.data.feedUrl);

            return {
                ok: true,
                removed: deleteResult.changes
            };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: 'Database error'
            };
        }
    });
}