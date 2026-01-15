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
  icon_url TEXT,
  custom_title TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_after TEXT
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
  media_thumbnail TEXT,
  media_duration_seconds INTEGER,
  external_id TEXT,
  raw_guid TEXT,
  created_at TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0,
  playback_position REAL DEFAULT 0,
  read_at TEXT,
  enclosure TEXT
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folder_feeds (
  folder_id TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(folder_id, feed_url),
  FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY(feed_url) REFERENCES feeds(url) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auto_rules (
  id TEXT PRIMARY KEY,
  name TEXT,
  keyword TEXT NOT NULL,
  field TEXT NOT NULL,
  action TEXT NOT NULL,
  feed_url TEXT,
  created_at TEXT NOT NULL
);

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

CREATE TABLE IF NOT EXISTS _migration_status (
  name TEXT PRIMARY KEY,
  completed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_feed_published ON items(feed_url, published);
CREATE INDEX IF NOT EXISTS idx_items_source_published ON items(source, published);
CREATE INDEX IF NOT EXISTS idx_items_is_read ON items(is_read);
CREATE INDEX IF NOT EXISTS idx_items_is_starred ON items(is_starred);
CREATE INDEX IF NOT EXISTS idx_folder_feeds_feed_url ON folder_feeds(feed_url);
CREATE INDEX IF NOT EXISTS idx_folder_feeds_folder_id ON folder_feeds(folder_id);
CREATE INDEX IF NOT EXISTS idx_reader_cache_updated ON reader_cache(updated_at);
