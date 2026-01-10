import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDatabase } from '../db/connection.js';
import { validateUpdateSettingsBody } from '../utils/validators.js';

export async function settingsRoutes(fastify: FastifyInstance) {
  // GET /api/settings - Get all settings
  fastify.get('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
    const db = getDatabase();
    const settings = db.prepare('SELECT * FROM settings').all() as Array<{ key: string; value: string }>;

    // Convert array to object
    const settingsObj: Record<string, string> = {};
    for (const setting of settings) {
      settingsObj[setting.key] = setting.value;
    }

    return { ok: true, settings: settingsObj };
  });

  // GET /api/settings/:key - Get a specific setting
  fastify.get('/settings/:key', async (request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
    if (!request.params?.key || typeof request.params.key !== 'string' || request.params.key.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Setting key is required' });
    }

    const db = getDatabase();
    const setting = db.prepare('SELECT * FROM settings WHERE key = ?').get(request.params.key);

    if (!setting) {
      return reply.code(404).send({ ok: false, error: 'Setting not found' });
    }

    return { ok: true, setting };
  });

  // PUT /api/settings/:key - Update a setting
  fastify.put('/settings/:key', async (request: FastifyRequest<{ Params: { key: string }, Body: any }>, reply: FastifyReply) => {
    if (!request.params?.key || typeof request.params.key !== 'string' || request.params.key.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Setting key is required' });
    }

    if (!request.body || typeof (request.body as any).value !== 'string') {
      return reply.code(400).send({ ok: false, error: 'Setting value is required' });
    }

    const db = getDatabase();
    const { value } = request.body as { value: string };

    // Check if setting exists
    const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(request.params.key);

    if (existing) {
      // Update existing
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value, request.params.key);
    } else {
      // Insert new
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(request.params.key, value);
    }

    return { ok: true, key: request.params.key, value };
  });

  // PUT /api/settings - Update multiple settings
  fastify.put('/settings', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    try {
      const validated = validateUpdateSettingsBody(request.body);
      const db = getDatabase();

      const updated: string[] = [];

      for (const [key, value] of Object.entries(validated)) {
        // Check if setting exists
        const existing = db.prepare('SELECT * FROM settings WHERE key = ?').get(key);

        if (existing) {
          // Update existing
          db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(value, key);
        } else {
          // Insert new
          db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
        }

        updated.push(key);
      }

      return { ok: true, updated };
    } catch (error) {
      return reply.code(400).send({ ok: false, error: error instanceof Error ? error.message : 'Validation failed' });
    }
  });

  // DELETE /api/settings/:key - Delete a setting
  fastify.delete('/settings/:key', async (request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
    if (!request.params?.key || typeof request.params.key !== 'string' || request.params.key.trim().length === 0) {
      return reply.code(400).send({ ok: false, error: 'Setting key is required' });
    }

    const db = getDatabase();

    const result = db.prepare('DELETE FROM settings WHERE key = ?').run(request.params.key);

    if (result.changes === 0) {
      return reply.code(404).send({ ok: false, error: 'Setting not found' });
    }

    return { ok: true, deleted: result.changes };
  });
}
