import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { aiRecommendationService } from '../services/ai-recommendations.js';
import { createBackup, listBackups } from '../services/backup-service.js';
import { findDiscussions } from '../services/discussion-service.js';
import { env } from '../config/index.js';
import fs from 'fs';
import sanitizeHtml from 'sanitize-html';
import { 
    SettingsSchema, 
    CreateRuleSchema, 
    SummarizeItemSchema, 
    DiscussionQuerySchema 
} from '../types/schemas.js';

const upsertHealthCheck = db.prepare(`
  INSERT INTO meta (key, value) 
  VALUES ('last_healthcheck', ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

export default async function systemRoutes(fastify: FastifyInstance, options: any) {
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
    fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
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
    fastify.get('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const settings = db.prepare('SELECT key, value FROM meta').all() as any[];
            const config: Record<string, string> = {};
            settings.forEach(s => {
                config[s.key] = s.value;
            });
            if (!config[env.SYNC_INTERVAL_KEY]) config[env.SYNC_INTERVAL_KEY] = 'off';
            return { ok: true, settings: config };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return { ok: false, error: 'Database error' };
        }
    });

    fastify.patch('/settings', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = SettingsSchema.safeParse(request.body);
        if (!result.success) {
            reply.code(400);
            return { ok: false, error: result.error.issues[0].message };
        }

        try {
            const stmt = db.prepare(`
                INSERT INTO meta (key, value) 
                VALUES (?, ?) 
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `);
            db.transaction(() => {
                for (const [key, value] of Object.entries(result.data)) {
                    stmt.run(key, value);
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
    fastify.post('/ai/summarize', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = SummarizeItemSchema.safeParse(request.body);
        
        if (!result.success) {
            reply.code(400); 
            return { ok: false, error: result.error.issues[0].message };
        }

        const { itemId } = result.data;

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
    fastify.get('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
        const rules = db.prepare('SELECT * FROM auto_rules ORDER BY created_at DESC').all();
        return { ok: true, rules };
    });

    fastify.post('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = CreateRuleSchema.safeParse(request.body);
        
        if (!result.success) {
            reply.code(400);
            return { ok: false, error: result.error.issues[0].message };
        }

        const { name, keyword, field, action, feed_url } = result.data;
        const id = `rule_${Date.now()}`;
        
        try {
            db.prepare('INSERT INTO auto_rules (id, name, keyword, field, action, feed_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(id, name, keyword, field, action, feed_url, new Date().toISOString());
            return { ok: true, id };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return { ok: false, error: 'Database error' };
        }
    });

    fastify.delete('/rules/:id', async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };
        db.prepare('DELETE FROM auto_rules WHERE id = ?').run(id);
        return { ok: true };
    });

    // Backup Management
    fastify.post('/backups', async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const result = createBackup();
            return { ok: true, result };
        } catch (e: any) {
            request.log.error(e);
            reply.code(500);
            return { ok: false, error: 'Backup failed' };
        }
    });

    fastify.get('/backups', async (request: FastifyRequest, reply: FastifyReply) => {
        return { ok: true, backups: listBackups() };
    });

    fastify.get('/backups/:filename', async (request: FastifyRequest, reply: FastifyReply) => {
        const { filename } = request.params as { filename: string };
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
    fastify.get('/discussions', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = DiscussionQuerySchema.safeParse(request.query);
        
        if (!result.success) {
            reply.code(400); 
            return { ok: false, error: result.error.issues[0].message };
        }

        try {
            const discussions = await findDiscussions(result.data.url);
            return { ok: true, discussions };
        } catch (e: any) {
            request.log.error(e);
            reply.code(500);
            return { ok: false, error: 'Failed to fetch discussions' };
        }
    });
}