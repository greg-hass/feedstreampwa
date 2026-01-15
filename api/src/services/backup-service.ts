import fs from 'fs';
import path from 'path';
import { db } from '../db/client.js';

const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups');

export function initBackupService() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

export interface BackupResult {
    filename: string;
    path: string;
    size: number;
    createdAt: Date;
}

export function listBackups(): BackupResult[] {
    try {
        if (!fs.existsSync(BACKUP_DIR)) return [];
        
        const files = fs.readdirSync(BACKUP_DIR);
        return files
            .filter(f => f.endsWith('.opml') || f.endsWith('.json'))
            .map(f => {
                const stats = fs.statSync(path.join(BACKUP_DIR, f));
                return {
                    filename: f,
                    path: path.join(BACKUP_DIR, f),
                    size: stats.size,
                    createdAt: stats.birthtime
                };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (e) {
        console.error('Failed to list backups:', e);
        return [];
    }
}

export function generateOpml(): string {
    
    // Get all folders
    const folders = db.prepare('SELECT id, name FROM folders ORDER BY name').all() as {id: string, name: string}[];
    
    // Get all feeds
    const feeds = db.prepare('SELECT url, title, site_url, kind FROM feeds').all() as {url: string, title: string, site_url: string, kind: string}[];
    
    // Get mappings (feed in folder)
    const folderFeeds = db.prepare('SELECT folder_id, feed_url FROM folder_feeds').all() as {folder_id: string, feed_url: string}[];
    
    // Create map of feedUrl -> folderId
    const feedFolderMap = new Map<string, string>();
    folderFeeds.forEach(ff => feedFolderMap.set(ff.feed_url, ff.folder_id));
    
    let opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
    <head>
        <title>FeedStream Subscription Export</title>
        <dateCreated>${new Date().toUTCString()}</dateCreated>
    </head>
    <body>\n`;

    // 1. Output folders and their feeds
    for (const folder of folders) {
        opml += `        <outline text="${escapeXml(folder.name)}" title="${escapeXml(folder.name)}">\n`;
        
        const feedsInFolder = feeds.filter(f => feedFolderMap.get(f.url) === folder.id);
        for (const feed of feedsInFolder) {
            opml += `            <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.site_url || '')}"/>\n`;
        }
        
        opml += `        </outline>\n`;
    }
    
    // 2. Output root feeds (not in any folder)
    const rootFeeds = feeds.filter(f => !feedFolderMap.has(f.url));
    for (const feed of rootFeeds) {
        opml += `        <outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(feed.title)}" xmlUrl="${escapeXml(feed.url)}" htmlUrl="${escapeXml(feed.site_url || '')}"/>\n`;
    }

    opml += `    </body>
</opml>`;

    return opml;
}

export function generateSettingsJson(): string {
    // Export meta table (settings)
    const settings = db.prepare('SELECT key, value FROM meta').all();
    return JSON.stringify(settings, null, 2);
}

export function createBackup(): { opmlPath: string, settingsPath: string } {
    initBackupService();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Generate OPML
    const opmlContent = generateOpml();
    const opmlFilename = `feedstream-backup-${timestamp}.opml`;
    const opmlPath = path.join(BACKUP_DIR, opmlFilename);
    fs.writeFileSync(opmlPath, opmlContent);
    
    // Generate Settings
    const settingsContent = generateSettingsJson();
    const settingsFilename = `feedstream-settings-${timestamp}.json`;
    const settingsPath = path.join(BACKUP_DIR, settingsFilename);
    fs.writeFileSync(settingsPath, settingsContent);
    
    return { opmlPath, settingsPath };
}

function escapeXml(unsafe: string): string {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}
