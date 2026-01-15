/**
 * Integration tests for feeds routes
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeSchema, applyMigrations } from '../db/schema.js';

// Create test database using vi.hoisted to make it available to the mock
const { sharedDb } = vi.hoisted(() => {
    // Create in-memory test database before any imports
    const db = new (require('better-sqlite3').default)(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    return { sharedDb: db };
});

// Mock the db client to use our test database
vi.mock('../db/client.js', () => ({
    db: sharedDb
}));

import Fastify, { FastifyInstance } from 'fastify';
import feedRoutes from './feeds.js';

describe('Feeds Routes', () => {
    let app: FastifyInstance;
    // Use the shared test database
    const db = sharedDb;

    beforeAll(async () => {
        // Initialize schema on the shared database
        initializeSchema(db);
        applyMigrations(db);

        // Create Fastify instance
        app = Fastify({ logger: false });

        await app.register(feedRoutes, { prefix: '/api' });

        await app.ready();
    });

    afterAll(async () => {
        await app.close();
        db.close();
    });

    beforeEach(() => {
        // Clear data before each test
        db.prepare('DELETE FROM items').run();
        db.prepare('DELETE FROM feeds').run();
        db.prepare('DELETE FROM folders').run();
        db.prepare('DELETE FROM folder_feeds').run();
    });

    describe('GET /api/feeds', () => {
        it('should return empty array when no feeds exist', async () => {
            const response = await app.inject({
                method: 'GET',
                url: '/api/feeds'
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);
            expect(data.feeds).toEqual([]);
        });

        it('should return list of feeds', async () => {
            // Add test feed
            db.prepare(`
                INSERT INTO feeds (url, kind, title, site_url, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                'https://example.com/feed.xml',
                'generic',
                'Example Feed',
                'https://example.com',
                new Date().toISOString(),
                200
            );

            const response = await app.inject({
                method: 'GET',
                url: '/api/feeds'
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);
            expect(data.feeds).toHaveLength(1);
            expect(data.feeds[0].url).toBe('https://example.com/feed.xml');
            expect(data.feeds[0].title).toBe('Example Feed');
        });

        it('should include unread count', async () => {
            const feedUrl = 'https://example.com/feed.xml';

            // Add feed
            db.prepare(`
                INSERT INTO feeds (url, kind, title, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?)
            `).run(feedUrl, 'generic', 'Example Feed', new Date().toISOString(), 200);

            // Add unread items
            db.prepare(`
                INSERT INTO items (id, feed_url, source, title, url, published, created_at, is_read)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                'item-1',
                feedUrl,
                'https://example.com',
                'Unread Item',
                'https://example.com/1',
                new Date().toISOString(),
                new Date().toISOString(),
                0
            );

            const response = await app.inject({
                method: 'GET',
                url: '/api/feeds'
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);
            expect(data.feeds[0].unreadCount).toBe(1);
        });
    });

    describe('PATCH /api/feeds', () => {
        it('should update feed title', async () => {
            const feedUrl = 'https://example.com/feed.xml';

            // Add test feed
            db.prepare(`
                INSERT INTO feeds (url, kind, title, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?)
            `).run(feedUrl, 'generic', 'Original Title', new Date().toISOString(), 200);

            const response = await app.inject({
                method: 'PATCH',
                url: '/api/feeds',
                payload: {
                    url: feedUrl,
                    title: 'New Title'
                }
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);
            expect(data.ok).toBe(true);

            // Verify in database
            const feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(feedUrl) as any;
            expect(feed.custom_title).toBe('New Title');
        });

        it('should return 404 for non-existent feed', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/api/feeds',
                payload: {
                    url: 'https://nonexistent.com/feed.xml',
                    title: 'New Title'
                }
            });

            expect(response.statusCode).toBe(404);
            const data = JSON.parse(response.body);
            expect(data.ok).toBe(false);
        });

        it('should validate request body', async () => {
            const response = await app.inject({
                method: 'PATCH',
                url: '/api/feeds',
                payload: {
                    url: 'not-a-url',
                    title: 'Title'
                }
            });

            expect(response.statusCode).toBe(400);
        });
    });

    describe('DELETE /api/feeds', () => {
        it('should delete feed and associated items in transaction', async () => {
            const feedUrl = 'https://example.com/feed.xml';

            // Add feed
            db.prepare(`
                INSERT INTO feeds (url, kind, title, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?)
            `).run(feedUrl, 'generic', 'Test Feed', new Date().toISOString(), 200);

            // Add item
            db.prepare(`
                INSERT INTO items (id, feed_url, source, title, url, published, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                'item-1',
                feedUrl,
                'https://example.com',
                'Test Item',
                'https://example.com/1',
                new Date().toISOString(),
                new Date().toISOString()
            );

            const response = await app.inject({
                method: 'DELETE',
                url: `/api/feeds?url=${encodeURIComponent(feedUrl)}`
            });

            expect(response.statusCode).toBe(200);
            const data = JSON.parse(response.body);
            expect(data.ok).toBe(true);

            // Verify feed is deleted
            const feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(feedUrl);
            expect(feed).toBeUndefined();

            // Verify items are deleted (transaction test)
            const itemCount = db.prepare('SELECT COUNT(*) as count FROM items WHERE feed_url = ?')
                .get(feedUrl) as any;
            expect(itemCount.count).toBe(0);
        });

        it('should return 404 for non-existent feed', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: '/api/feeds?url=https://nonexistent.com/feed.xml'
            });

            expect(response.statusCode).toBe(404);
        });

        it('should require url parameter', async () => {
            const response = await app.inject({
                method: 'DELETE',
                url: '/api/feeds'
            });

            expect(response.statusCode).toBe(400);
            const data = JSON.parse(response.body);
            expect(data.error).toContain('url');
        });
    });
});
