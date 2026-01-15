import { db } from '../db/client.js';
import { fetchFeed } from './feed-service.js';
import { createBackup } from './backup-service.js';
import { env } from '../config/index.js';
import pLimit from 'p-limit';

let backgroundSyncTimer: NodeJS.Timeout | null = null;

function parseInterval(interval: string): number | null {
    if (interval === 'off') return null;
    const match = interval.match(/^(\d+)([mhd])$/);
    if (!match) return null;
    const val = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 'h') return val * 60 * 60 * 1000;
    if (unit === 'd') return val * 24 * 60 * 60 * 1000;
    return null;
}

export async function startBackgroundSync(logger: any) {
    logger.info('Starting background sync runner...');

    // Run every minute to check if sync is due
    backgroundSyncTimer = setInterval(async () => {
        try {
            // Check for daily backup
            const lastBackupSetting = db.prepare('SELECT value FROM meta WHERE key = ?').get(env.LAST_BACKUP_KEY) as any;
            const lastBackup = lastBackupSetting ? parseInt(lastBackupSetting.value, 10) : 0;
            const now = Date.now();

            if (now - lastBackup >= 24 * 60 * 60 * 1000) {
                try {
                    logger.info('Running automatic daily backup and maintenance...');
                    createBackup();
                    
                    // Maintenance: Purge reader cache older than 30 days
                    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
                    const purgeResult = db.prepare('DELETE FROM reader_cache WHERE updated_at < ?').run(thirtyDaysAgo);
                    if (purgeResult.changes > 0) {
                        logger.info(`Purged ${purgeResult.changes} old reader cache entries`);
                    }

                    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                        .run(env.LAST_BACKUP_KEY, now.toString());
                } catch (e) {
                    logger.error(e as any, 'Auto maintenance failed');
                }
            }

            const intervalSetting = db.prepare('SELECT value FROM meta WHERE key = ?').get(env.SYNC_INTERVAL_KEY) as any;
            const intervalStr = intervalSetting?.value || 'off';

            if (intervalStr === 'off') return;

            const intervalMs = parseInterval(intervalStr);
            if (!intervalMs) return;

            const lastSyncSetting = db.prepare('SELECT value FROM meta WHERE key = ?').get(env.LAST_SYNC_KEY) as any;
            const lastSync = lastSyncSetting ? parseInt(lastSyncSetting.value, 10) : 0;

            if (now - lastSync >= intervalMs) {
                logger.info(`Background sync triggered (interval: ${intervalStr})...`);

                // Get all feed URLs
                const feeds = db.prepare('SELECT url FROM feeds').all() as any[];
                const urls = feeds.map(f => f.url);

                if (urls.length === 0) return;

                // Update last sync time BEFORE starting to prevent concurrent triggers if it takes long
                db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
                    .run(env.LAST_SYNC_KEY, now.toString());

                const limit = pLimit(env.MAX_CONCURRENCY);
                await Promise.all(
                    urls.map((url: string) => limit(() => fetchFeed(url, false)))
                );

                logger.info('Background sync completed');
            }
        } catch (error: any) {
            logger.error(error, 'Background sync error');
        }
    }, 60 * 1000);
}

export function stopBackgroundSync() {
    if (backgroundSyncTimer) {
        clearInterval(backgroundSyncTimer);
        backgroundSyncTimer = null;
    }
}
