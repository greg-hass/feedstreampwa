import Database from 'better-sqlite3';
import path from 'path';

import type { Database as DatabaseType } from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH || '/data/feedstream.sqlite';

// Initialize SQLite database
const db: DatabaseType = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Helper: Check if a column exists in a table
function columnExists(tableName: string, columnName: string): boolean {
    const result = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    return result.some((col: any) => col.name === columnName);
}

// Create schema on startup
db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS feeds (
    url TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT,
    site_url TEXT,
    etag TEXT,
    last_modified TEXT,
    last_checked TEXT,
    last_status INTEGER,
    last_error TEXT,
    icon_url TEXT
  );

  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    feed_url TEXT NOT NULL,
    source TEXT NOT NULL,
    title TEXT,
    url TEXT,
    author TEXT,
    summary TEXT,
    content TEXT,
    published TEXT,
    updated TEXT,
    read_at TEXT,
    media_thumbnail TEXT,
    media_duration_seconds INTEGER,
    external_id TEXT,
    raw_guid TEXT,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_items_feed_published 
    ON items(feed_url, published);
  
  CREATE INDEX IF NOT EXISTS idx_items_source_published 
    ON items(source, published);
`);

// Safe migration: Add is_read column if it doesn't exist
if (!columnExists('items', 'is_read')) {
    console.log('Adding is_read column to items table...');
    db.exec(`ALTER TABLE items ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0`);
    console.log('is_read column added successfully');
}

// Create index on is_read (safe to run multiple times)
db.exec(`CREATE INDEX IF NOT EXISTS idx_items_is_read ON items(is_read)`);

// Safe migration: Add read_at column if it doesn't exist
if (!columnExists('items', 'read_at')) {
    console.log('Adding read_at column to items table...');
    db.exec(`ALTER TABLE items ADD COLUMN read_at TEXT`);
    console.log('read_at column added successfully');
}

// Create index on read_at (safe to run multiple times)
db.exec(`CREATE INDEX IF NOT EXISTS idx_items_read_at ON items(read_at)`);

// Backfill read_at for already-read items if missing
db.exec(`
    UPDATE items
    SET read_at = COALESCE(published, created_at)
    WHERE is_read = 1 AND read_at IS NULL
`);

// Safe migration: Add is_starred column if it doesn't exist
if (!columnExists('items', 'is_starred')) {
    console.log('Adding is_starred column to items table...');
    db.exec(`ALTER TABLE items ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0`);
    console.log('is_starred column added successfully');
}

// Create index on is_starred (safe to run multiple times)
db.exec(`CREATE INDEX IF NOT EXISTS idx_items_is_starred ON items(is_starred)`);

// Migration: Normalize existing published/updated dates to ISO strings for correct sorting
db.exec(`
    CREATE TABLE IF NOT EXISTS _migration_status (
        name TEXT PRIMARY KEY,
        completed_at TEXT NOT NULL
    )
`);

const migrationCheck = db.prepare('SELECT completed_at FROM _migration_status WHERE name = ?').get('normalize_dates');
if (!migrationCheck) {
    console.log('Running date normalization migration...');
    const items = db.prepare('SELECT id, published, updated FROM items').all() as any[];
    const updateStmt = db.prepare('UPDATE items SET published = ?, updated = ? WHERE id = ?');

    let updatedCount = 0;
    db.transaction(() => {
        for (const item of items) {
            let pub = item.published;
            let upd = item.updated;

            try {
                if (pub) pub = new Date(pub).toISOString();
            } catch (e) { /* ignore */ }

            try {
                if (upd) upd = new Date(upd).toISOString();
            } catch (e) { /* ignore */ }

            if (pub !== item.published || upd !== item.updated) {
                updateStmt.run(pub, upd, item.id);
                updatedCount++;
            }
        }
    })();

    db.prepare('INSERT INTO _migration_status (name, completed_at) VALUES (?, ?)').run('normalize_dates', new Date().toISOString());
    console.log(`Date normalization migration complete. Updated ${updatedCount} items.`);
}

// Safe migration: Add icon_url column to feeds table if it doesn't exist
if (!columnExists('feeds', 'icon_url')) {
    console.log('Adding icon_url column to feeds table...');
    db.exec(`ALTER TABLE feeds ADD COLUMN icon_url TEXT`);
    console.log('icon_url column added successfully');
}

// Safe migration: Add custom_title column to feeds table if it doesn't exist
if (!columnExists('feeds', 'custom_title')) {
    console.log('Adding custom_title column to feeds table...');
    db.exec(`ALTER TABLE feeds ADD COLUMN custom_title TEXT`);
    console.log('custom_title column added successfully');
}

// Create folders table
db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folder_feeds (
        folder_id TEXT NOT NULL,
        feed_url TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (folder_id, feed_url),
        FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
        FOREIGN KEY (feed_url) REFERENCES feeds(url) ON DELETE CASCADE
    );
`);

export { db };
