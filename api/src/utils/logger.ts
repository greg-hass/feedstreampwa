/**
 * Logger utility for services and modules that don't have access to Fastify instance
 * Uses pino for structured logging
 */
import pino from 'pino';

// Create a logger instance with appropriate configuration
export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname'
            }
        }
        : undefined
});

// Re-export for convenience
export default logger;
