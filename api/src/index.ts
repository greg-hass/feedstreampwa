import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import compress from '@fastify/compress';

// Configuration and Database
import { env, isDevelopment } from './config/index.js';
import { db } from './db/client.js';
import { setupRateLimiting } from './middleware/rate-limit.js';

// Route imports
import authRoutes from './routes/auth.js';
import feedRoutes from './routes/feeds.js';
import itemRoutes from './routes/items.js';
import folderRoutes from './routes/folders.js';
import readerRoutes from './routes/reader.js';
import refreshRoutes from './routes/refresh.js';
import systemRoutes from './routes/system.js';
import opmlRoutes from './routes/opml.js';

// Middleware imports
import { validateBody, validateQuery, validateFeedUrlMiddleware, sanitizeHtmlMiddleware, validateRequestSizeMiddleware, validateSearchQueryMiddleware } from './middleware/validation.js';

// Service imports
import { initBackupService } from './services/backup-service.js';
import { startBackgroundSync, stopBackgroundSync } from './services/scheduler.js';

// Initialize Fastify
const fastify = Fastify({
    logger: true
});

const start = async () => {
    try {
        initBackupService();

        // Register security middleware
        await fastify.register(helmet, {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    frameSrc: ["'self'", "https://www.youtube.com"],
                },
            },
        });

        // CORS Configuration
        // If ALLOWED_ORIGINS is set, restrict to those origins
        // Otherwise, allow all origins (suitable for personal/single-user deployments)
        const allowedOrigins = env.ALLOWED_ORIGINS
            ? env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
            : null;

        await fastify.register(cors, {
            origin: (origin, callback) => {
                // If no allowed origins configured, allow all (personal use mode)
                if (!allowedOrigins) {
                    callback(null, true);
                    return;
                }

                // Otherwise, check against the allowed list
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'), false);
                }
            },
            credentials: true,
        });

        await fastify.register(compress);

        // Per-route rate limiting (configured in middleware/rate-limit.ts)
        await setupRateLimiting(fastify);

        fastify.log.info('Security middleware registered (including per-route rate limiting)');

        // Register Routes (Caddy strips /api prefix before proxying)
        fastify.register(authRoutes);
        fastify.register(feedRoutes);
        fastify.register(itemRoutes);
        fastify.register(folderRoutes);
        fastify.register(readerRoutes);
        fastify.register(refreshRoutes);
        fastify.register(systemRoutes);
        fastify.register(opmlRoutes);

        await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
        fastify.log.info(`Server listening on http://0.0.0.0:${env.PORT}`);

        // Start background sync
        startBackgroundSync(fastify.log);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

const shutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    stopBackgroundSync();
    db.close();
    await fastify.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();