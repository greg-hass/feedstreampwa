-- Create a specific index for getting unread counts efficiently
CREATE INDEX IF NOT EXISTS idx_items_unread_feed ON items(feed_url, is_read);

-- Create a specific index for starring (often queried globally)
CREATE INDEX IF NOT EXISTS idx_items_starred_global ON items(is_starred) WHERE is_starred = 1;

-- Optimize feed management queries (last_checked sorting)
CREATE INDEX IF NOT EXISTS idx_feeds_checked ON feeds(last_checked);

-- Full covering index for the main items query
-- Used by: GET /items
-- Covers: feed_url + published sorting
CREATE INDEX IF NOT EXISTS idx_items_feed_date ON items(feed_url, published DESC);

-- Covers: source + published sorting
CREATE INDEX IF NOT EXISTS idx_items_source_date ON items(source, published DESC);
