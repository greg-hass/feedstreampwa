// Database schema definitions and migrations

const SCHEMA = `
  -- Meta table for app settings
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Feeds table
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
    icon_url TEXT,
    custom_title TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_after TEXT
  );

  -- Items table
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
    media_thumbnail TEXT,
    media_duration_seconds INTEGER,
    external_id TEXT,
    raw_guid TEXT,
    created_at TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    playback_position REAL DEFAULT 0
  );

  -- Folders table
  CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  -- Folder-feed associations
  CREATE TABLE IF NOT EXISTS folder_feeds (
    folder_id TEXT NOT NULL,
    feed_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY(folder_id, feed_url),
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY(feed_url) REFERENCES feeds(url) ON DELETE CASCADE
  );

  -- Reader cache table
  CREATE TABLE IF NOT EXISTS reader_cache (
    url TEXT PRIMARY KEY,
    title TEXT,
    byline TEXT,
    excerpt TEXT,
    site_name TEXT,
    image_url TEXT,
    content_html TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Migration status table
  CREATE TABLE IF NOT EXISTS _migration_status (
    name TEXT PRIMARY KEY,
    completed_at TEXT NOT NULL
  );
`;

const INDEXES = `
  -- Items indexes
  CREATE INDEX IF NOT EXISTS idx_items_feed_published ON items(feed_url, published);
  CREATE INDEX IF NOT EXISTS idx_items_source_published ON items(source, published);
  CREATE INDEX IF NOT EXISTS idx_items_is_read ON items(is_read);
  CREATE INDEX IF NOT EXISTS idx_items_is_starred ON items(is_starred);

  -- Folder feeds indexes
  CREATE INDEX IF NOT EXISTS idx_folder_feeds_feed_url ON folder_feeds(feed_url);
  CREATE INDEX IF NOT EXISTS idx_folder_feeds_folder_id ON folder_feeds(folder_id);

  -- Reader cache index
  CREATE INDEX IF NOT EXISTS idx_reader_cache_updated ON reader_cache(updated_at);
`;

export function initializeSchema(database: any): void {
  database.exec(SCHEMA);
  database.exec(INDEXES);
}

export function applyMigrations(database: any): void {
  // Migration: Add is_read column
  if (!columnExists(database, 'items', 'is_read')) {
    database.exec(`ALTER TABLE items ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0`);
  }

  // Migration: Add is_starred column
  if (!columnExists(database, 'items', 'is_starred')) {
    database.exec(`ALTER TABLE items ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0`);
  }

  // Migration: Add icon_url column to feeds
  if (!columnExists(database, 'feeds', 'icon_url')) {
    database.exec(`ALTER TABLE feeds ADD COLUMN icon_url TEXT`);
  }

  // Migration: Add custom_title column to feeds
  if (!columnExists(database, 'feeds', 'custom_title')) {
    database.exec(`ALTER TABLE feeds ADD COLUMN custom_title TEXT`);
  }

  // Migration: Add playback_position column to items
  if (!columnExists(database, 'items', 'playback_position')) {
    database.exec(`ALTER TABLE items ADD COLUMN playback_position REAL DEFAULT 0`);
  }

  // Migration: Add retry_count column to feeds
  if (!columnExists(database, 'feeds', 'retry_count')) {
    database.exec(`ALTER TABLE feeds ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0`);
  }

  // Migration: Add next_retry_after column to feeds
  if (!columnExists(database, 'feeds', 'next_retry_after')) {
    database.exec(`ALTER TABLE feeds ADD COLUMN next_retry_after TEXT`);
  }

  // Migration: Normalize dates
  const migrationCheck = database.prepare('SELECT completed_at FROM _migration_status WHERE name = ?').get('normalize_dates');
  if (!migrationCheck) {
    const items = database.prepare('SELECT id, published, updated FROM items').all();
    const updateStmt = database.prepare('UPDATE items SET published = ?, updated = ? WHERE id = ?');

    let updatedCount = 0;
    database.transaction(() => {
      for (const item of items) {
        let pub = item.published;
        let upd = item.updated;

        try {
          if (pub) pub = new Date(pub).toISOString();
        } catch { /* ignore */ }

        try {
          if (upd) upd = new Date(upd).toISOString();
        } catch { /* ignore */ }

        if (pub !== item.published || upd !== item.updated) {
          updateStmt.run(pub, upd, item.id);
          updatedCount++;
        }
      }
    })();

    database.prepare('INSERT INTO _migration_status (name, completed_at) VALUES (?, ?)').run('normalize_dates', new Date().toISOString());
  }

  // FTS5 setup
  try {
    database.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS _fts5_test USING fts5(test)`);
    database.exec(`DROP TABLE _fts5_test`);
  } catch (error) {
    throw new Error('FTS5 extension is required but not available');
  }

  // Create FTS5 virtual table if it doesn't exist
  const ftsTableExists = database.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='items_fts'
  `).get();

  if (!ftsTableExists) {
    database.exec(`
      CREATE VIRTUAL TABLE items_fts USING fts5(
        title,
        summary,
        content,
        content=items,
        content_rowid=rowid
      )
    `);

    // Create triggers to keep FTS in sync
    database.exec(`
      CREATE TRIGGER items_ai AFTER INSERT ON items BEGIN
        INSERT INTO items_fts(rowid, title, summary, content)
        VALUES (new.rowid, new.title, new.summary, new.content);
      END;
    `);

    database.exec(`
      CREATE TRIGGER items_ad AFTER DELETE ON items BEGIN
        DELETE FROM items_fts WHERE rowid = old.rowid;
      END;
    `);

    database.exec(`
      CREATE TRIGGER items_au AFTER UPDATE OF title, summary, content ON items BEGIN
        UPDATE items_fts 
        SET title = new.title, summary = new.summary, content = new.content
        WHERE rowid = new.rowid;
      END;
    `);

    // Populate initial FTS index from existing items
    const itemCount = database.prepare('SELECT COUNT(*) as count FROM items').get();
    if (itemCount.count > 0) {
      database.exec(`
        INSERT INTO items_fts(rowid, title, summary, content)
        SELECT rowid, title, summary, content FROM items
      `);
    }
  }
}

function columnExists(database: any, tableName: string, columnName: string): boolean {
  const result = database.prepare(`PRAGMA table_info(${tableName})`).all();
  return result.some((col: any) => col.name === columnName);
}
