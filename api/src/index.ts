import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import compress from '@fastify/compress';

// Configuration and Database
import { env } from './config/index.js';
import { db } from './db/client.js';

// Route imports
import feedRoutes from './routes/feeds.js';
import itemRoutes from './routes/items.js';
import folderRoutes from './routes/folders.js';
import readerRoutes from './routes/reader.js';
import refreshRoutes from './routes/refresh.js';
import systemRoutes from './routes/system.js';

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

        await fastify.register(cors, {
            origin: true,
            credentials: true,
        });

        await fastify.register(compress);

        await fastify.register(rateLimit, {
            max: 100,
            timeWindow: '1 minute',
            errorResponseBuilder: () => ({
                ok: false,
                error: 'Rate limit exceeded. Please try again later.',
                statusCode: 429,
            }),
        });

        fastify.log.info('Security middleware registered');

        // Register Routes
        fastify.register(feedRoutes);
        fastify.register(itemRoutes);
        fastify.register(folderRoutes);
        fastify.register(readerRoutes);
        fastify.register(refreshRoutes);
        fastify.register(systemRoutes);

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