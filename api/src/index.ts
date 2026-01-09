import Fastify from 'fastify';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const PORT = parseInt(process.env.PORT || '3000', 10);
const DB_PATH = process.env.DB_PATH || '/data/feedstream.sqlite';

// Initialize Fastify
const fastify = Fastify({
    logger: {
        level: 'info',
        transport: {
            target: 'pino-pretty',
            options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
            }
        }
    }
});

// Initialize SQLite database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Create meta table on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

fastify.log.info(`Database initialized at ${DB_PATH}`);

// Prepare statement for upserting health check time
const upsertHealthCheck = db.prepare(`
  INSERT INTO meta (key, value) 
  VALUES ('last_healthcheck', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

// Health check endpoint
fastify.get('/health', async (request, reply) => {
    const now = new Date().toISOString();

    try {
        upsertHealthCheck.run(now);

        return {
            ok: true,
            time: now
        };
    } catch (error) {
        fastify.log.error(error);
        reply.code(500);
        return {
            ok: false,
            error: 'Database error'
        };
    }
});

// Start server
const start = async () => {
    try {
        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        fastify.log.info(`Server listening on http://0.0.0.0:${PORT}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Graceful shutdown
const shutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    db.close();
    await fastify.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
