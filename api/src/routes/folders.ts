import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { validateCreateFolderBody, validateRenameFolderBody } from '../utils/validators.js';

export async function folderRoutes(fastify: FastifyInstance) {
  // GET /api/folders - List all folders
  fastify.get('/folders', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();
    const folders = db.prepare(`
      SELECT 
        f.*,
        COUNT(DISTINCT fm.feed_id) as feedCount
      FROM folders f
      LEFT JOIN folder_feeds fm ON fm.folder_id = f.id
      GROUP BY f.id
      ORDER BY f.name
    `).all();

    return { ok: true, folders };
  });

  // GET /api/folders/:id - Get a specific folder
  fastify.get('/folders/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Folder ID is required' });
    }

    const db = getDatabase();
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(request.params.id);

    if (!folder) {
      return reply.code(404).send({ ok: false, error: 'Folder not found' });
    }

    // Get feeds in this folder
    const feeds = db.prepare(`
      SELECT f.*
      FROM feeds f
      JOIN folder_feeds fm ON fm.feed_id = f.id
      WHERE fm.folder_id = ?
    `).all(request.params.id);

    return { ok: true, folder: { ...folder, feeds } };
  });

  // POST /api/folders - Create a new folder
  fastify.post('/folders', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const validated = validateCreateFolderBody(request.body);
      const db = getDatabase();
      const { name } = validated;

      const result = db.prepare('INSERT INTO folders (name) VALUES (?)').run(name);

      return { ok: true, id: result.lastInsertRowid };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // PUT /api/folders/:id - Rename a folder
  fastify.put('/folders/:id', async (request: FastifyRequest<{ Params: { id: string }, Body: any }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Folder ID is required' });
    }

    try {
      const validated = validateRenameFolderBody(request.body);
      const db = getDatabase();
      const { name } = validated;

      const result = db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(name, request.params.id);

      if (result.changes === 0) {
        return reply.code(404).send({ ok: false, error: 'Folder not found' });
      }

      return { ok: true, updated: result.changes };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // DELETE /api/folders/:id - Delete a folder
  fastify.delete('/folders/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Folder ID is required' });
    }

    const db = getDatabase();

    // Delete folder-feed associations first
    db.prepare('DELETE FROM folder_feeds WHERE folder_id = ?').run(request.params.id);

    // Delete the folder
    const result = db.prepare('DELETE FROM folders WHERE id = ?').run(request.params.id);

    if (result.changes === 0) {
      return reply.code(404).send({ ok: false, error: 'Folder not found' });
    }

    return { ok: true, deleted: result.changes };
  });

  // POST /api/folders/:id/feeds/:feedId - Add a feed to a folder
  fastify.post('/folders/:id/feeds/:feedId', async (request: FastifyRequest<{ Params: { id: string; feedId: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Folder ID is required' });
    }
    if (!request.params?.feedId || typeof request.params.feedId !== 'string' || request.params.feedId.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed ID is required' });
    }

    const db = getDatabase();

    // Check if folder exists
    const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(request.params.id);
    if (!folder) {
      return reply.code(404).send({ ok: false, error: 'Folder not found' });
    }

    // Check if feed exists
    const feed = db.prepare('SELECT * FROM feeds WHERE id = ?').get(request.params.feedId);
    if (!feed) {
      return reply.code(404).send({ ok: false, error: 'Feed not found' });
    }

    // Add feed to folder (ignore if already exists)
    db.prepare('INSERT OR IGNORE INTO folder_feeds (folder_id, feed_id) VALUES (?, ?)')
      .run(request.params.id, request.params.feedId);

    return { ok: true, message: 'Feed added to folder' };
  });

  // DELETE /api/folders/:id/feeds/:feedId - Remove a feed from a folder
  fastify.delete('/folders/:id/feeds/:feedId', async (request: FastifyRequest<{ Params: { id: string; feedId: string } }>, reply: FastifyReply) => {
    if (!request.params?.id || typeof request.params.id !== 'string' || request.params.id.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Folder ID is required' });
    }
    if (!request.params?.feedId || typeof request.params.feedId !== 'string' || request.params.feedId.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Feed ID is required' });
    }

    const db = getDatabase();

    const result = db.prepare('DELETE FROM folder_feeds WHERE folder_id = ? AND feed_id = ?')
      .run(request.params.id, request.params.feedId);

    if (result.changes === 0) {
      return reply.code(404).send({ ok: false, error: 'Feed not found in folder' });
    }

    return { ok: true, deleted: result.changes };
  });
}
