import Database from 'better-sqlite3';
import { env } from '../config/index.js';
import { initializeSchema, applyMigrations } from './schema.js';

// Create database instance
const db = new Database(env.DB_PATH);
db.pragma('journal_mode = WAL');

// Export a getter function to avoid TypeScript naming conflicts
export function getDatabase(): Database.Database {
  return db;
}

// Helper: Check if a column exists in a table
export function columnExists(tableName: string, columnName: string): boolean {
  const result = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
  return result.some((col: any) => col.name === columnName);
}

// Initialize database schema and migrations
export function initializeDatabase(): void {
  initializeSchema(db);
  applyMigrations(db);
}
