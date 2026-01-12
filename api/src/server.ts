import Fastify from 'fastify';
import { env, isDevelopment } from './config/index.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { feedRoutes } from './routes/feeds.js';
import { itemRoutes } from './routes/items.js';
import { folderRoutes } from './routes/folders.js';
import { settingsRoutes } from './routes/settings.js';
import { readerRoutes } from './routes/reader.js';
import { searchRoutes } from './routes/search.js';
import { refreshRoutes } from './routes/refresh.js';
import { opmlRoutes } from './routes/opml.js';
import { initializeDatabase } from './db/connection.js';

// Initialize Fastify
const fastify = Fastify({
  logger: {
    level: isDevelopment ? 'debug' : 'info',
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  }
});

// Register global error handlers
fastify.setErrorHandler(errorHandler);
fastify.setNotFoundHandler(notFoundHandler);

// Register routes
fastify.register(feedRoutes);
fastify.register(itemRoutes);
fastify.register(folderRoutes);
fastify.register(settingsRoutes);
fastify.register(readerRoutes);
fastify.register(searchRoutes);
fastify.register(refreshRoutes);
fastify.register(opmlRoutes, { prefix: '/opml' });

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const now = new Date().toISOString();
  
  try {
    // Simple health check - update timestamp in database
    await initializeDatabase();
    
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
    // Initialize database
    await initializeDatabase();
    
    const address = await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  fastify.log.info('Shutting down gracefully...');
  await fastify.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { fastify, start, shutdown };
