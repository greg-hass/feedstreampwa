import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function applyMigrations(db: any): void {
    // Ensure migration table exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            applied_at TEXT NOT NULL
        )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    if (!fs.existsSync(migrationsDir)) {
        logger.error('CRITICAL: Migration directory not found. Schema may be outdated.');
        throw new Error(`Migration directory missing at ${migrationsDir}. Ensure build process copies .sql files.`);
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    const appliedMigrations = db.prepare('SELECT name FROM _migrations').all() as any[];
    const appliedNames = new Set(appliedMigrations.map(m => m.name));

    for (const file of files) {
        if (!appliedNames.has(file)) {
            if (file === '006_add_enclosure_column.sql' && columnExists(db, 'items', 'enclosure')) {
                logger.info(`Skipping migration (already applied): ${file}`);
                db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
                    .run(file, new Date().toISOString());
                continue;
            }
            logger.info(`Applying migration: ${file}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            
            try {
                db.transaction(() => {
                    db.exec(sql);
                    db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
                        .run(file, new Date().toISOString());
                })();
                logger.info(`Successfully applied migration: ${file}`);
            } catch (error) {
                logger.error({ err: error }, `Failed to apply migration ${file}`);
                throw error;
            }
        }
    }

    // Handle legacy migrations (like date normalization)
    runLegacyMigrations(db);
}

function runLegacyMigrations(db: any) {
    // Create legacy status table if not exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS _migration_status (
            name TEXT PRIMARY KEY,
            completed_at TEXT NOT NULL
        )
    `);

    const name = 'normalize_dates';
    const check = db.prepare('SELECT completed_at FROM _migration_status WHERE name = ?').get(name);
    
    if (!check) {
        logger.info('Running legacy date normalization migration...');
        const items = db.prepare('SELECT id, published, updated FROM items').all() as any[];
        const updateStmt = db.prepare('UPDATE items SET published = ?, updated = ? WHERE id = ?');

        db.transaction(() => {
            for (const item of items) {
                let pub = item.published;
                let upd = item.updated;
                try { if (pub) pub = new Date(pub).toISOString(); } catch { }
                try { if (upd) upd = new Date(upd).toISOString(); } catch { }
                if (pub !== item.published || upd !== item.updated) {
                    updateStmt.run(pub, upd, item.id);
                }
            }
        })();

        db.prepare('INSERT INTO _migration_status (name, completed_at) VALUES (?, ?)')
            .run(name, new Date().toISOString());
        logger.info('Legacy date normalization complete.');
    }
}

function columnExists(db: any, tableName: string, columnName: string): boolean {
    try {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
        return columns.some((col) => col.name === columnName);
    } catch (error) {
        logger.warn({ err: error }, `Failed to check column ${columnName} on ${tableName}`);
        return false;
    }
}

export function initializeSchema(db: any): void {
    // This is now handled by migration 001_initial.sql
    // But we keep it empty or as a placeholder if needed.
}
