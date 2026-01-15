
import { db } from '../db/client.js';
import { fetchFeed } from '../services/feed-service.js';
import { RefreshFeedsSchema, RefreshStatusQuerySchema } from '../types/schemas.js';
import logger from '../utils/logger.js';
import pLimit from 'p-limit';

const MAX_JOBS = 5;
const JOB_TTL = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL = 2 * 60 * 1000; // Cleanup every 2 minutes
const refreshJobs = new Map<string, RefreshJob>();

interface RefreshJob {
    id: string;
    status: 'running' | 'done' | 'error';
    current: number;
    total: number;
    message?: string;
    startedAt: number;
}

// Periodic cleanup of old jobs to prevent memory leaks
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [id, job] of refreshJobs.entries()) {
        if (now - job.startedAt > JOB_TTL) {
            refreshJobs.delete(id);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        logger.info({ cleanedCount }, 'Cleaned up old refresh jobs');
    }
}, CLEANUP_INTERVAL);

// Ensure cleanup interval is cleared on shutdown
process.on('SIGTERM', () => clearInterval(cleanupInterval));
process.on('SIGINT', () => clearInterval(cleanupInterval));

export default async function refreshRoutes(fastify: any, options: any) {
    // Start refresh job - expensive operation, stricter rate limit
    fastify.post('/refresh/start', {
        config: {
            rateLimit: {
                max: 10,
                timeWindow: '1 minute'
            }
        }
    }, async (request: any, reply: any) => {
        // Validate request body
        const parseResult = RefreshFeedsSchema.safeParse(request.body);
        if (!parseResult.success) {
            reply.code(400);
            return { ok: false, error: 'Invalid request body', details: parseResult.error.issues };
        }

        const { urls: specificUrls } = parseResult.data;

        // limit concurrent jobs
        if (refreshJobs.size >= MAX_JOBS) {
            // cleanup old jobs
            const now = Date.now();
            for (const [id, job] of refreshJobs.entries()) {
                if (now - job.startedAt > JOB_TTL) {
                    refreshJobs.delete(id);
                }
            }
            if (refreshJobs.size >= MAX_JOBS) {
                reply.code(429);
                return { ok: false, error: 'Too many refresh jobs active' };
            }
        }

        let urlsToRefresh: string[] = [];

        try {
            if (specificUrls && Array.isArray(specificUrls) && specificUrls.length > 0) {
                urlsToRefresh = specificUrls;
            } else {
                try {
                    const feeds = db.prepare('SELECT url FROM feeds').all() as any[];
                    urlsToRefresh = feeds.map(f => f.url);
                } catch (dbError: any) {
                    fastify.log.error('Database error fetching feeds:', dbError);
                    reply.code(500);
                    return { ok: false, error: 'Failed to fetch feeds from database' };
                }
            }

            const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            if (urlsToRefresh.length === 0) {
                // Create a job that immediately completes
                refreshJobs.set(jobId, {
                    id: jobId,
                    status: 'done',
                    current: 0,
                    total: 0,
                    message: 'No feeds to refresh',
                    startedAt: Date.now()
                });
                return { ok: true, jobId };
            }

            refreshJobs.set(jobId, {
                id: jobId,
                status: 'running',
                current: 0,
                total: urlsToRefresh.length,
                message: 'Starting refresh...',
                startedAt: Date.now()
            });

            // Start processing in background (no await)
            processRefresh(jobId, urlsToRefresh, fastify.log);

            return { ok: true, jobId };

        } catch (error: any) {
            fastify.log.error({ error }, 'Failed to start refresh job');
            reply.code(500);
            return { ok: false, error: 'Failed to start refresh job' };
        }
    });

    // Get job status
    fastify.get('/refresh/status', async (request: any, reply: any) => {
        // Validate query parameters
        const parseResult = RefreshStatusQuerySchema.safeParse(request.query);
        if (!parseResult.success) {
            reply.code(400);
            return { ok: false, error: 'Invalid query parameters', details: parseResult.error.issues };
        }

        const { jobId } = parseResult.data;

        if (!refreshJobs.has(jobId)) {
            // If job not found, assume done if it's an old ID
            return { status: 'done', current: 0, total: 0 };
        }

        const job = refreshJobs.get(jobId);
        return job;
    });

    // Internal helper to process refresh
    async function processRefresh(jobId: string, urls: string[], logger: any) {
        const job = refreshJobs.get(jobId);
        if (!job) return;

        const limit = pLimit(6); // Concurrency

        let completed = 0;
        
        try {
            await Promise.all(urls.map(url => limit(async () => {
                try {
                    await fetchFeed(url, true); // force refresh
                } catch (e) {
                    logger.warn(`Failed to refresh ${url}: ${e}`);
                } finally {
                    completed++;
                    const currentJob = refreshJobs.get(jobId);
                    if (currentJob) {
                        currentJob.current = completed;
                        currentJob.message = `Refreshed ${completed} of ${urls.length}`;
                    }
                }
            })));

            const finalJob = refreshJobs.get(jobId);
            if (finalJob) {
                finalJob.status = 'done';
                finalJob.message = 'Refresh completed';
            }
        } catch (e) {
            logger.error(`Refresh job ${jobId} failed: ${e}`);
            const errorJob = refreshJobs.get(jobId);
            if (errorJob) {
                errorJob.status = 'error';
                errorJob.message = 'Internal error during refresh';
            }
        }
    }
}
