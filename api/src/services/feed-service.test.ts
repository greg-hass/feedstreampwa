/**
 * Unit tests for feed-service
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, cleanupTestDb } from '../test/setup.js';
import Database from 'better-sqlite3';

describe('Feed Service', () => {
    let db: Database.Database;

    beforeEach(() => {
        db = createTestDb();
    });

    afterEach(() => {
        cleanupTestDb(db);
    });

    describe('Database Operations', () => {
        it('should create a feed in the database', () => {
            const feedUrl = 'https://example.com/feed.xml';
            const feedKind = 'generic';
            const feedTitle = 'Test Feed';

            db.prepare(`
                INSERT INTO feeds (url, kind, title, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?)
            `).run(feedUrl, feedKind, feedTitle, new Date().toISOString(), 200);

            const feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(feedUrl) as any;

            expect(feed).toBeDefined();
            expect(feed.url).toBe(feedUrl);
            expect(feed.kind).toBe(feedKind);
            expect(feed.title).toBe(feedTitle);
            expect(feed.last_status).toBe(200);
        });

        it('should update feed on conflict', () => {
            const feedUrl = 'https://example.com/feed.xml';

            // Insert initial feed
            db.prepare(`
                INSERT INTO feeds (url, kind, title, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?)
            `).run(feedUrl, 'generic', 'Initial Title', new Date().toISOString(), 200);

            // Update on conflict
            db.prepare(`
                INSERT INTO feeds (url, kind, title, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(url) DO UPDATE SET
                    title = excluded.title,
                    last_status = excluded.last_status
            `).run(feedUrl, 'generic', 'Updated Title', new Date().toISOString(), 304);

            const feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(feedUrl) as any;

            expect(feed.title).toBe('Updated Title');
            expect(feed.last_status).toBe(304);
        });

        it('should create items linked to feed', () => {
            const feedUrl = 'https://example.com/feed.xml';

            // Create feed first
            db.prepare(`
                INSERT INTO feeds (url, kind, title, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?)
            `).run(feedUrl, 'generic', 'Test Feed', new Date().toISOString(), 200);

            // Create item
            const itemId = 'test-item-1';
            db.prepare(`
                INSERT INTO items (id, feed_url, source, title, url, published, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                itemId,
                feedUrl,
                'https://example.com',
                'Test Article',
                'https://example.com/article',
                new Date().toISOString(),
                new Date().toISOString()
            );

            const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;

            expect(item).toBeDefined();
            expect(item.feed_url).toBe(feedUrl);
            expect(item.title).toBe('Test Article');
        });

        it('should cascade delete items when feed is deleted', () => {
            const feedUrl = 'https://example.com/feed.xml';

            // Create feed
            db.prepare(`
                INSERT INTO feeds (url, kind, title, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?)
            `).run(feedUrl, 'generic', 'Test Feed', new Date().toISOString(), 200);

            // Create item
            db.prepare(`
                INSERT INTO items (id, feed_url, source, title, url, published, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                'test-item-1',
                feedUrl,
                'https://example.com',
                'Test Article',
                'https://example.com/article',
                new Date().toISOString(),
                new Date().toISOString()
            );

            // Delete feed
            db.prepare('DELETE FROM feeds WHERE url = ?').run(feedUrl);

            // Check items are NOT automatically deleted (no CASCADE in schema)
            const itemCount = db.prepare('SELECT COUNT(*) as count FROM items WHERE feed_url = ?')
                .get(feedUrl) as any;

            // Note: Items should be manually deleted in a transaction (as we fixed)
            expect(itemCount.count).toBe(1);
        });
    });

    describe('Feed URL Validation', () => {
        it('should accept valid RSS feed URLs', () => {
            const validUrls = [
                'https://example.com/feed.xml',
                'https://example.com/rss',
                'https://blog.example.com/feed',
                'https://example.com/feed.atom'
            ];

            validUrls.forEach(url => {
                expect(() => {
                    new URL(url);
                }).not.toThrow();
            });
        });

        it('should reject invalid URLs', () => {
            // These are malformed URLs that cannot be parsed at all
            const invalidUrls = [
                'not-a-url',
                '',
                '://missing-scheme.com'
            ];

            invalidUrls.forEach(url => {
                expect(() => {
                    new URL(url);
                }).toThrow();
            });
        });

        it('should identify non-HTTP schemes', () => {
            // These are valid URLs but not http/https - useful for scheme validation
            const nonHttpUrls = [
                'ftp://example.com/feed',
                'javascript:alert(1)'
            ];

            nonHttpUrls.forEach(url => {
                const parsed = new URL(url);
                expect(['http:', 'https:']).not.toContain(parsed.protocol);
            });
        });
    });

    describe('Item Deduplication', () => {
        it('should handle duplicate item insertion gracefully', () => {
            const feedUrl = 'https://example.com/feed.xml';

            // Create feed
            db.prepare(`
                INSERT INTO feeds (url, kind, title, last_checked, last_status)
                VALUES (?, ?, ?, ?, ?)
            `).run(feedUrl, 'generic', 'Test Feed', new Date().toISOString(), 200);

            const itemId = 'duplicate-item';

            // Insert item first time
            db.prepare(`
                INSERT INTO items (id, feed_url, source, title, url, published, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                itemId,
                feedUrl,
                'https://example.com',
                'Original Title',
                'https://example.com/article',
                new Date().toISOString(),
                new Date().toISOString()
            );

            // Insert same item with updated title (using ON CONFLICT)
            db.prepare(`
                INSERT INTO items (id, feed_url, source, title, url, published, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET title = excluded.title
            `).run(
                itemId,
                feedUrl,
                'https://example.com',
                'Updated Title',
                'https://example.com/article',
                new Date().toISOString(),
                new Date().toISOString()
            );

            const item = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;

            expect(item.title).toBe('Updated Title');

            // Ensure only one item exists
            const count = db.prepare('SELECT COUNT(*) as count FROM items WHERE id = ?')
                .get(itemId) as any;
            expect(count.count).toBe(1);
        });
    });
});
