/**
 * Test setup and utilities
 */
import Database from 'better-sqlite3';
import { beforeEach, afterEach } from 'vitest';
import { initializeSchema, applyMigrations } from '../db/schema.js';

// In-memory test database
let testDb: Database.Database;

/**
 * Create a fresh test database for each test
 */
export function createTestDb(): Database.Database {
    const db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Initialize schema and apply migrations
    initializeSchema(db);
    applyMigrations(db);

    return db;
}

/**
 * Seed test database with sample data
 */
export function seedTestDb(db: Database.Database) {
    // Add a sample feed
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

    // Add sample items
    db.prepare(`
        INSERT INTO items (
            id, feed_url, source, title, url, published, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        'item-1',
        'https://example.com/feed.xml',
        'https://example.com',
        'Test Article',
        'https://example.com/article-1',
        new Date().toISOString(),
        new Date().toISOString()
    );

    // Add a sample folder
    db.prepare(`
        INSERT INTO folders (id, name, created_at)
        VALUES (?, ?, ?)
    `).run('folder-1', 'Test Folder', new Date().toISOString());

    return db;
}

/**
 * Clean up test database
 */
export function cleanupTestDb(db: Database.Database) {
    if (db) {
        db.close();
    }
}

/**
 * Auto-setup for tests
 */
beforeEach(() => {
    testDb = createTestDb();
});

afterEach(() => {
    if (testDb) {
        cleanupTestDb(testDb);
    }
});

export { testDb };
