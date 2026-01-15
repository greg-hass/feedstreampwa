/**
 * Per-route rate limiting configuration
 */
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Rate limit tiers based on operation type
 */
export const RateLimitTiers = {
    // Read operations - generous limits
    READ: {
        max: 100,
        timeWindow: '1 minute',
        description: 'Read operations (GET)'
    },

    // Write operations - more restrictive
    WRITE: {
        max: 30,
        timeWindow: '1 minute',
        description: 'Write operations (POST, PUT, PATCH, DELETE)'
    },

    // Expensive operations - very restrictive
    EXPENSIVE: {
        max: 10,
        timeWindow: '1 minute',
        description: 'Expensive operations (refresh, AI, search)'
    },

    // Authentication/sensitive - strict
    AUTH: {
        max: 5,
        timeWindow: '1 minute',
        description: 'Authentication operations'
    }
} as const;

/**
 * Custom rate limit configuration for specific routes
 */
export const RouteRateLimits: Record<string, typeof RateLimitTiers[keyof typeof RateLimitTiers]> = {
    // Refresh operations - expensive
    '/api/refresh/start': RateLimitTiers.EXPENSIVE,

    // AI operations - very expensive
    '/api/ai/summarize': RateLimitTiers.EXPENSIVE,
    '/api/feeds/recommendations': RateLimitTiers.EXPENSIVE,

    // Search operations - moderately expensive
    '/api/feeds/search': RateLimitTiers.EXPENSIVE,

    // Write operations
    '/api/feeds': RateLimitTiers.WRITE,
    '/api/items': RateLimitTiers.WRITE,
    '/api/folders': RateLimitTiers.WRITE,
    '/api/settings': RateLimitTiers.WRITE,
};

/**
 * Get rate limit for a specific route
 */
export function getRateLimitForRoute(url: string, method: string): typeof RateLimitTiers[keyof typeof RateLimitTiers] {
    // Check for exact route match
    if (RouteRateLimits[url]) {
        return RouteRateLimits[url];
    }

    // Check for pattern match (e.g., /api/items/:id)
    for (const [pattern, limit] of Object.entries(RouteRateLimits)) {
        if (url.startsWith(pattern)) {
            return limit;
        }
    }

    // Default based on HTTP method
    if (method === 'GET' || method === 'HEAD') {
        return RateLimitTiers.READ;
    } else {
        return RateLimitTiers.WRITE;
    }
}

/**
 * Create rate limit plugin with custom key generator
 */
export async function setupRateLimiting(fastify: FastifyInstance) {
    await fastify.register(rateLimit, {
        global: false, // Don't apply globally, we'll use per-route
        keyGenerator: (request: FastifyRequest) => {
            // Rate limit by IP address
            return request.ip;
        },
        errorResponseBuilder: (request, context) => ({
            ok: false,
            error: 'Rate limit exceeded. Please try again later.',
            statusCode: 429,
            retryAfter: context.after
        }),
    });
}

/**
 * Apply rate limit to a route
 */
export function applyRateLimit(
    fastify: FastifyInstance,
    url: string,
    method: string
) {
    const limit = getRateLimitForRoute(url, method);

    return {
        config: {
            rateLimit: {
                max: limit.max,
                timeWindow: limit.timeWindow
            }
        }
    };
}
