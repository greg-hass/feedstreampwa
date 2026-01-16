
import { db } from '../db/client.js';
import { fetchFeed } from '../services/feed-service.js';
import { RefreshFeedsSchema, RefreshStatusQuerySchema } from '../types/schemas.js';
import { authenticateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import { env } from '../config/index.js';
import { publishRefreshEvent, subscribeRefreshEvents } from '../services/refresh-events.js';
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
    currentFeedUrl?: string;
    currentFeedTitle?: string;
    startedAt: number;
}

const upsertLastSync = db.prepare(`
  INSERT INTO meta (key, value)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

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
        const feedTitleMap = new Map<string, string>();

        try {
            if (specificUrls && Array.isArray(specificUrls) && specificUrls.length > 0) {
                urlsToRefresh = specificUrls;
                const placeholders = specificUrls.map(() => '?').join(',');
                if (placeholders.length > 0) {
                    const feedRows = db.prepare(
                        `SELECT url, COALESCE(custom_title, title, url) as display_title FROM feeds WHERE url IN (${placeholders})`
                    ).all(...specificUrls) as any[];
                    feedRows.forEach((row) => {
                        feedTitleMap.set(row.url, row.display_title || row.url);
                    });
                }
            } else {
                try {
                    const feeds = db.prepare(
                        'SELECT url, COALESCE(custom_title, title, url) as display_title FROM feeds'
                    ).all() as any[];
                    urlsToRefresh = feeds.map(f => f.url);
                    feeds.forEach((feed) => {
                        feedTitleMap.set(feed.url, feed.display_title || feed.url);
                    });
                } catch (dbError: any) {
                    fastify.log.error('Database error fetching feeds:', dbError);
                    reply.code(500);
                    return { ok: false, error: 'Failed to fetch feeds from database' };
                }
            }

            const startedAt = Date.now();
            const jobId = `job_${startedAt}_${Math.random().toString(36).substr(2, 9)}`;

            if (urlsToRefresh.length === 0) {
                // Create a job that immediately completes
                refreshJobs.set(jobId, {
                    id: jobId,
                    status: 'done',
                    current: 0,
                    total: 0,
                    message: 'No feeds to refresh',
                    startedAt
                });
                try {
                    upsertLastSync.run(env.LAST_SYNC_KEY, startedAt.toString());
                } catch (metaError: any) {
                    fastify.log.warn({ err: metaError }, 'Failed to update last sync timestamp');
                }
                publishRefreshEvent({
                    type: 'complete',
                    jobId,
                    current: 0,
                    total: 0,
                    message: 'No feeds to refresh',
                    startedAt,
                    lastSync: startedAt,
                    source: 'manual'
                });
                return { ok: true, jobId };
            }

            refreshJobs.set(jobId, {
                id: jobId,
                status: 'running',
                current: 0,
                total: urlsToRefresh.length,
                message: 'Starting refresh...',
                startedAt
            });

            try {
                upsertLastSync.run(env.LAST_SYNC_KEY, startedAt.toString());
            } catch (metaError: any) {
                fastify.log.warn({ err: metaError }, 'Failed to update last sync timestamp');
            }

            publishRefreshEvent({
                type: 'start',
                jobId,
                current: 0,
                total: urlsToRefresh.length,
                message: 'Starting refresh...',
                startedAt,
                lastSync: startedAt,
                source: 'manual'
            });

            // Start processing in background (no await)
            processRefresh(jobId, urlsToRefresh, fastify.log, feedTitleMap);

            return { ok: true, jobId };

        } catch (error: any) {
            fastify.log.error({ error }, 'Failed to start refresh job');
            reply.code(500);
            return { ok: false, error: 'Failed to start refresh job' };
        }
    });

    fastify.get('/refresh/stream', async (request: any, reply: any) => {
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.flushHeaders?.();
        reply.hijack();

        const sendEvent = (eventName: string, payload: any) => {
            reply.raw.write(`event: ${eventName}\n`);
            reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
        };

        const unsubscribe = subscribeRefreshEvents((payload) => {
            sendEvent('refresh', payload);
        });

        const pingTimer = setInterval(() => {
            sendEvent('ping', { ts: Date.now() });
        }, 20000);

        try {
            const lastSyncSetting = db.prepare('SELECT value FROM meta WHERE key = ?')
                .get(env.LAST_SYNC_KEY) as any;
            const lastSync = lastSyncSetting?.value ? parseInt(lastSyncSetting.value, 10) : NaN;
            if (Number.isFinite(lastSync)) {
                sendEvent('sync', { lastSync });
            }
        } catch (e) {
            fastify.log.warn({ err: e }, 'Failed to fetch last sync for refresh stream');
        }

        const runningJobs = Array.from(refreshJobs.values())
            .filter((job) => job.status === 'running')
            .sort((a, b) => b.startedAt - a.startedAt);
        if (runningJobs.length > 0) {
            const job = runningJobs[0];
            sendEvent('refresh', {
                type: 'progress',
                jobId: job.id,
                current: job.current,
                total: job.total,
                message: job.message,
                currentFeedTitle: job.currentFeedTitle,
                currentFeedUrl: job.currentFeedUrl,
                startedAt: job.startedAt,
                source: 'manual'
            });
        }

        request.raw.on('close', () => {
            clearInterval(pingTimer);
            unsubscribe();
        });
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
    async function processRefresh(
        jobId: string,
        urls: string[],
        logger: any,
        feedTitleMap: Map<string, string>
    ) {
        const job = refreshJobs.get(jobId);
        if (!job) return;
        const startedAt = job.startedAt;

        const limit = pLimit(6); // Concurrency

        let completed = 0;

        try {
            await Promise.all(urls.map(url => limit(async () => {
                const displayTitle = feedTitleMap.get(url) || url;
                const currentJob = refreshJobs.get(jobId);
                if (currentJob) {
                    currentJob.currentFeedUrl = url;
                    currentJob.currentFeedTitle = displayTitle;
                    currentJob.message = 'Refreshing feeds...';
                }
                try {
                    await fetchFeed(url, true); // force refresh
                } catch (e) {
                    logger.warn(`Failed to refresh ${url}: ${e}`);
                } finally {
                    completed++;
                    const updatedJob = refreshJobs.get(jobId);
                    if (updatedJob) {
                        updatedJob.current = completed;
                        updatedJob.message = `Refreshed ${completed} of ${urls.length}`;
                    }
                    publishRefreshEvent({
                        type: 'progress',
                        jobId,
                        current: completed,
                        total: urls.length,
                        message: `Refreshed ${completed} of ${urls.length}`,
                        currentFeedTitle: displayTitle,
                        currentFeedUrl: url,
                        startedAt,
                        source: 'manual'
                    });
                }
            })));

            const finalJob = refreshJobs.get(jobId);
            if (finalJob) {
                finalJob.status = 'done';
                finalJob.message = 'Refresh completed';
                finalJob.currentFeedTitle = undefined;
                finalJob.currentFeedUrl = undefined;
            }
            publishRefreshEvent({
                type: 'complete',
                jobId,
                current: completed,
                total: urls.length,
                message: 'Refresh completed',
                startedAt,
                lastSync: startedAt,
                source: 'manual'
            });
        } catch (e) {
            logger.error(`Refresh job ${jobId} failed: ${e}`);
            const errorJob = refreshJobs.get(jobId);
            if (errorJob) {
                errorJob.status = 'error';
                errorJob.message = 'Internal error during refresh';
                errorJob.currentFeedTitle = undefined;
                errorJob.currentFeedUrl = undefined;
            }
            publishRefreshEvent({
                type: 'error',
                jobId,
                current: completed,
                total: urls.length,
                message: 'Internal error during refresh',
                startedAt,
                source: 'manual'
            });
        }
    }
}
