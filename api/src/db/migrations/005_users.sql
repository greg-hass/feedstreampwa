-- Add users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login TEXT
);

-- Add user_id to feeds table for data isolation
ALTER TABLE feeds ADD COLUMN user_id TEXT;

-- Add user_id to items table for data isolation
ALTER TABLE items ADD COLUMN user_id TEXT;

-- Add user_id to folders table for data isolation
ALTER TABLE folders ADD COLUMN user_id TEXT;

-- Create indexes for user_id lookups
CREATE INDEX IF NOT EXISTS idx_feeds_user_id ON feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_items_user_id ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

-- Migrate existing data to a default user
-- This ensures backward compatibility for existing installations
INSERT OR IGNORE INTO users (id, email, password_hash, created_at)
VALUES ('default_user', 'default@local', '', datetime('now'));

UPDATE feeds SET user_id = 'default_user' WHERE user_id IS NULL;
UPDATE items SET user_id = 'default_user' WHERE user_id IS NULL;
UPDATE folders SET user_id = 'default_user' WHERE user_id IS NULL;
