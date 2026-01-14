import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import pLimit from 'p-limit';
import fs from 'fs';
import sanitizeHtml from 'sanitize-html';

// Import extracted modules
import { db } from './db/client.js';
import { fetchFeed } from './services/feed-service.js';
import feedRoutes from './routes/feeds.js';
import itemRoutes from './routes/items.js';
import folderRoutes from './routes/folders.js';
import readerRoutes from './routes/reader.js';

// Import services
import { aiRecommendationService } from './services/ai-recommendations.js';
import { createBackup, listBackups, initBackupService } from './services/backup-service.js';
import { findDiscussions } from './services/discussion-service.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '6', 10);

// Refresh job tracking
interface RefreshJob {
    id: string;
    status: 'running' | 'done' | 'error';
    current: number;
    total: number;
    message?: string;
    startedAt: number;
}

const refreshJobs = new Map<string, RefreshJob>();
const MAX_JOBS = 5;

// Settings and Background Sync
let backgroundSyncTimer: NodeJS.Timeout | null = null;
const SYNC_INTERVAL_KEY = 'sync_interval';
const LAST_SYNC_KEY = 'last_global_sync';
const LAST_BACKUP_KEY = 'last_auto_backup';

function parseInterval(interval: string): number | null {
    if (interval === 'off') return null;
    const match = interval.match(/^(\d+)([mhd])$/);
    if (!match) return null;
    const val = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 'h') return val * 60 * 60 * 1000;
    if (unit === 'd') return val * 24 * 60 * 60 * 1000;
    return null;
}

async function startBackgroundSync() {
    fastify.log.info('Starting background sync runner...');

    // Run every minute to check if sync is due
    backgroundSyncTimer = setInterval(async () => {
        try {
            // Check for daily backup
            const lastBackupSetting = db.prepare('SELECT value FROM meta WHERE key = ?').get(LAST_BACKUP_KEY) as any;
            const lastBackup = lastBackupSetting ? parseInt(lastBackupSetting.value, 10) : 0;
            const now = Date.now();

            if (now - lastBackup >= 24 * 60 * 60 * 1000) {
                try {
                    fastify.log.info('Running automatic daily backup...');
                    createBackup();
                    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                        .run(LAST_BACKUP_KEY, now.toString());
                } catch (e) {
                    fastify.log.error(e as any, 'Auto backup failed');
                }
            }

            const intervalSetting = db.prepare('SELECT value FROM meta WHERE key = ?').get(SYNC_INTERVAL_KEY) as any;
            const intervalStr = intervalSetting?.value || 'off';

            if (intervalStr === 'off') return;

            const intervalMs = parseInterval(intervalStr);
            if (!intervalMs) return;

            const lastSyncSetting = db.prepare('SELECT value FROM meta WHERE key = ?').get(LAST_SYNC_KEY) as any;
            const lastSync = lastSyncSetting ? parseInt(lastSyncSetting.value, 10) : 0;

            if (now - lastSync >= intervalMs) {
                fastify.log.info(`Background sync triggered (interval: ${intervalStr})...`);

                // Get all feed URLs
                const feeds = db.prepare('SELECT url FROM feeds').all() as any[];
                const urls = feeds.map(f => f.url);

                if (urls.length === 0) return;

                // Update last sync time BEFORE starting to prevent concurrent triggers if it takes long
                db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                    .run(LAST_SYNC_KEY, now.toString());

                const limit = pLimit(MAX_CONCURRENCY);
                await Promise.all(
                    urls.map((url: string) => limit(() => fetchFeed(url, false)))
                );

                fastify.log.info('Background sync completed');
            }
        } catch (error: any) {
            fastify.log.error(error, 'Background sync error');
        }
    }, 60 * 1000);
}

// Initialize Fastify
const fastify = Fastify({
    logger: true
});

// Prepare statements for health check
const upsertHealthCheck = db.prepare(`
  INSERT INTO meta (key, value) 
  VALUES ('last_healthcheck', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

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

        // --- Legacy/Misc Routes (to be refactored later) ---

        // Health Check
        fastify.get('/health', async () => {
            try {
                const now = new Date().toISOString();
                upsertHealthCheck.run(now);
                return { status: 'ok', timestamp: now };
            } catch (error: any) {
                return { status: 'error', error: error.message };
            }
        });

        // Stats endpoint
        fastify.get('/stats', async (request: any, reply: any) => {
            try {
                const totalResult = db.prepare('SELECT COUNT(*) as count FROM items').get() as any;
                const totalArticles = totalResult?.count || 0;
                const readResult = db.prepare('SELECT COUNT(*) as count FROM items WHERE is_read = 1').get() as any;
                const readArticles = readResult?.count || 0;
                const starredResult = db.prepare('SELECT COUNT(*) as count FROM items WHERE is_starred = 1').get() as any;
                const starredArticles = starredResult?.count || 0;
                const feedsResult = db.prepare('SELECT COUNT(*) as count FROM feeds').get() as any;
                const totalFeeds = feedsResult?.count || 0;

                const topFeeds = db.prepare(`
                    SELECT 
                        feeds.title as name,
                        COUNT(items.id) as count
                    FROM items
                    JOIN feeds ON items.feed_url = feeds.url
                    WHERE items.is_read = 1
                    GROUP BY feeds.url
                    ORDER BY count DESC
                    LIMIT 10
                `).all() as Array<{ name: string; count: number }>;

                const readByDay = db.prepare(`
                    SELECT 
                        DATE(read_at) as day,
                        COUNT(*) as count
                    FROM items
                    WHERE is_read = 1 
                        AND read_at >= datetime('now', '-7 days')
                    GROUP BY DATE(read_at)
                    ORDER BY day DESC
                    LIMIT 7
                `).all() as Array<{ day: string; count: number }>;

                const formattedReadByDay = readByDay.reverse().map(item => {
                    const date = new Date(item.day);
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                    return {
                        day: dayName,
                        count: item.count
                    };
                });

                let readingStreak = 0;
                const streakQuery = db.prepare(`
                    SELECT DISTINCT DATE(read_at) as day
                    FROM items
                    WHERE is_read = 1
                    ORDER BY day DESC
                    LIMIT 30
                `).all() as Array<{ day: string }>;

                if (streakQuery.length > 0) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    for (let i = 0; i < streakQuery.length; i++) {
                        const readDate = new Date(streakQuery[i].day);
                        readDate.setHours(0, 0, 0, 0);
                        
                        const expectedDate = new Date(today);
                        expectedDate.setDate(today.getDate() - i);
                        
                        if (readDate.getTime() === expectedDate.getTime()) {
                            readingStreak++;
                        } else {
                            break;
                        }
                    }
                }

                return {
                    ok: true,
                    totalArticles,
                    readArticles,
                    starredArticles,
                    totalFeeds,
                    readingStreak,
                    avgReadTime: 0,
                    topFeeds,
                    readByDay: formattedReadByDay
                };
            } catch (error: any) {
                fastify.log.error(error);
                reply.code(500);
                return { ok: false, error: 'Failed to fetch stats' };
            }
        });

        // Settings endpoints
        fastify.get('/settings', async (request: any, reply: any) => {
            try {
                const settings = db.prepare('SELECT key, value FROM meta').all() as any[];
                const config: Record<string, string> = {};
                settings.forEach(s => {
                    config[s.key] = s.value;
                });
                if (!config[SYNC_INTERVAL_KEY]) config[SYNC_INTERVAL_KEY] = 'off';
                return { ok: true, settings: config };
            } catch (error: any) {
                fastify.log.error(error);
                reply.code(500);
                return { ok: false, error: 'Database error' };
            }
        });

        fastify.patch('/settings', async (request: any, reply: any) => {
            const body = request.body as any;
            if (!body || typeof body !== 'object') {
                reply.code(400);
                return { ok: false, error: 'Invalid body' };
            }
            try {
                const stmt = db.prepare(`
                    INSERT INTO meta (key, value) 
                    VALUES (?, ?) 
                    ON CONFLICT(key) DO UPDATE SET value = excluded.value
                `);
                db.transaction(() => {
                    for (const [key, value] of Object.entries(body)) {
                        if (typeof value === 'string') {
                            stmt.run(key, value);
                        }
                    }
                })();
                return { ok: true };
            } catch (error: any) {
                fastify.log.error(error);
                reply.code(500);
                return { ok: false, error: 'Database error' };
            }
        });

        // AI Summarization
        fastify.post('/ai/summarize', async (request: any, reply: any) => {
            const body = request.body as any;
            const { itemId } = body;
            
            if (!itemId) {
                reply.code(400); 
                return { ok: false, error: 'Missing itemId' };
            }

            try {
                const item = db.prepare('SELECT title, content, url FROM items WHERE id = ?').get(itemId) as any;
                if (!item) {
                     reply.code(404);
                     return { ok: false, error: 'Item not found' };
                }

                let content = item.content;
                if (item.url) {
                    const readerData = db.prepare('SELECT content_html FROM reader_cache WHERE url = ?').get(item.url) as any;
                    if (readerData?.content_html) {
                        content = readerData.content_html; 
                    }
                }
                
                const textContent = sanitizeHtml(content || '', { allowedTags: [], allowedAttributes: {} });

                if (!textContent || textContent.length < 50) {
                     return { ok: true, summary: "Content too short or empty to summarize." };
                }
                
                const summary = await aiRecommendationService.summarizeArticle(db, item.title, textContent);
                return { ok: true, summary };
            } catch (e: any) {
                request.log.error(e);
                reply.code(500);
                return { ok: false, error: e.message || 'AI generation failed' };
            }
        });

        // Rules Management
        fastify.get('/rules', async (request: any, reply: any) => {
            const rules = db.prepare('SELECT * FROM auto_rules ORDER BY created_at DESC').all();
            return { ok: true, rules };
        });

        fastify.post('/rules', async (request: any, reply: any) => {
            const body = request.body as any;
            const { name, keyword, field, action, feed_url } = body;
            if (!keyword || !field || !action) {
                reply.code(400);
                return { ok: false, error: 'Missing required fields' };
            }
            const id = `rule_${Date.now()}`;
            db.prepare('INSERT INTO auto_rules (id, name, keyword, field, action, feed_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, name, keyword, field, action, feed_url, new Date().toISOString());
            return { ok: true, id };
        });

        fastify.delete('/rules/:id', async (request: any, reply: any) => {
            const { id } = request.params as any;
            db.prepare('DELETE FROM auto_rules WHERE id = ?').run(id);
            return { ok: true };
        });

        // Backup Management
        fastify.post('/backups', async (request: any, reply: any) => {
            try {
                const result = createBackup();
                return { ok: true, result };
            } catch (e: any) {
                request.log.error(e);
                reply.code(500);
                return { ok: false, error: 'Backup failed' };
            }
        });

        fastify.get('/backups', async (request: any, reply: any) => {
            return { ok: true, backups: listBackups() };
        });

        fastify.get('/backups/:filename', async (request: any, reply: any) => {
            const { filename } = request.params as any;
            if (filename.includes('..') || filename.includes('/')) {
                reply.code(400);
                return { ok: false, error: 'Invalid filename' };
            }
            
            const backups = listBackups();
            const backup = backups.find(b => b.filename === filename);
            
            if (!backup) {
                reply.code(404);
                return { ok: false, error: 'Backup not found' };
            }
            
            const stream = fs.createReadStream(backup.path);
            reply.header('Content-Disposition', `attachment; filename="${filename}"`);
            return stream;
        });

        // Discussions
        fastify.get('/discussions', async (request: any, reply: any) => {
            const { url } = request.query as any;
            if (!url) {
                reply.code(400); 
                return { ok: false, error: 'Missing url parameter' };
            }

            try {
                const discussions = await findDiscussions(url);
                return { ok: true, discussions };
            } catch (e: any) {
                request.log.error(e);
                reply.code(500);
                return { ok: false, error: 'Failed to fetch discussions' };
            }
        });

        await fastify.listen({ port: PORT, host: '0.0.0.0' });
        fastify.log.info(`Server listening on http://0.0.0.0:${PORT}`);

        // Start background sync
        startBackgroundSync();
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

const shutdown = async () => {
    fastify.log.info('Shutting down gracefully...');
    if (backgroundSyncTimer) {
        clearInterval(backgroundSyncTimer);
    }
    db.close();
    await fastify.close();
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
