-- Additional performance indexes based on code review

-- Composite index for feed items query with unread filter
-- Optimizes: SELECT * FROM items WHERE feed_url = ? AND is_read = 0 ORDER BY published DESC
CREATE INDEX IF NOT EXISTS idx_items_feed_unread_date ON items(feed_url, is_read, published DESC);

-- Composite index for bookmarked items query
-- Optimizes: SELECT * FROM items WHERE is_starred = 1 ORDER BY published DESC
CREATE INDEX IF NOT EXISTS idx_items_starred_date ON items(is_starred, published DESC) WHERE is_starred = 1;

-- Index for folder feed operations
-- Optimizes: Folder feed counting and association queries
CREATE INDEX IF NOT EXISTS idx_folder_feeds_composite ON folder_feeds(folder_id, feed_url);

-- Index for item creation date for cleanup operations
-- Optimizes: Old item pruning queries
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
