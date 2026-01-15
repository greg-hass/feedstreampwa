import Database from 'better-sqlite3';
import { env } from '../config/index.js';
import { initializeSchema, applyMigrations } from './schema.js';

import type { Database as DatabaseType } from 'better-sqlite3';

const db: DatabaseType = new Database(env.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');
db.pragma('mmap_size = 30000000000'); // Use memory mapping for faster I/O
db.pragma('cache_size = -2000'); // 2MB cache

// Initialize schema and apply migrations
initializeSchema(db);
applyMigrations(db);

export { db };