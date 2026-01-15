import { XMLParser } from 'fast-xml-parser';
import { db } from '../db/client.js';
import { detectFeedKind } from '../utils/feed-utils.js';
import { randomUUID } from 'crypto';

interface ImportJob {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    total: number;
    current: number;
    currentName?: string;
    errors: string[];
    result: {
        added: number;
        skipped: number;
        failed: number;
    };
}

const jobs = new Map<string, ImportJob>();

export function getJobStatus(id: string) {
    return jobs.get(id);
}

export function createImportJob(opmlContent: string): string {
    const id = randomUUID();
    
    // Initial parse
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: ""
    });
    
    let parsed;
    try {
        parsed = parser.parse(opmlContent);
    } catch (e) {
        throw new Error('Invalid XML');
    }

    jobs.set(id, {
        id,
        status: 'pending',
        total: 0,
        current: 0,
        errors: [],
        result: { added: 0, skipped: 0, failed: 0 }
    });

    // Start async processing
    processImport(id, parsed);

    return id;
}

async function processImport(jobId: string, parsed: any) {
    const jobOrUndefined = jobs.get(jobId);
    if (!jobOrUndefined) return;
    const job = jobOrUndefined; // Verified reference

    try {
        job.status = 'running';
        
        // Flatten the structure first to count total and prepare actions
        // Structure: opml -> body -> outline (can be array or single object)
        
        const outlines = parsed?.opml?.body?.outline;
        if (!outlines) {
            throw new Error('No outlines found in OPML');
        }

        const actions: Array<() => void> = [];

        // Recursive function to traverse and build actions
        function traverse(node: any, folderId: string | null = null) {
            // Handle array of outlines
            if (Array.isArray(node)) {
                for (const item of node) {
                    traverse(item, folderId);
                }
                return;
            }

            // Single node
            const text = node.text || node.title || '';
            const xmlUrl = node.xmlUrl || node.url || ''; // Support both standard and non-standard

            if (xmlUrl) {
                // It's a feed
                actions.push(() => {
                    let feedUrl = xmlUrl;
                    
                    // Prevent re-converting YouTube RSS URLs
                    if (feedUrl.includes('youtube.com/') && !feedUrl.includes('youtube.com/feeds/videos.xml')) {
                        // If it's a channel URL in OPML, we could try to convert it here, 
                        // but for now let's just use it as is if it matches RSS.
                        // Actually, search tool already gives us RSS.
                    }

                    job.currentName = text || feedUrl;
                    
                    try {
                        // Check if feed exists
                        const existing = db.prepare('SELECT url FROM feeds WHERE url = ?').get(feedUrl);

                        if (!existing) {
                            db.prepare(`
                                INSERT INTO feeds (url, kind, title, site_url, icon_url, custom_title, last_status, retry_count)
                                VALUES (?, ?, ?, ?, NULL, NULL, 0, 0)
                            `).run(xmlUrl, detectFeedKind(xmlUrl), text, node.htmlUrl || null);
                            job.result.added++;
                        } else {
                            feedUrl = (existing as any).url;
                            job.result.skipped++;
                        }

                        // Add to folder if applicable
                        if (folderId) {
                            db.prepare('INSERT OR IGNORE INTO folder_feeds (folder_id, feed_url, created_at) VALUES (?, ?, ?)')
                                .run(folderId, feedUrl, new Date().toISOString());
                        }
                    } catch (e) {
                        job.result.failed++;
                        job.errors.push(`Failed to import ${xmlUrl}: ${e instanceof Error ? e.message : String(e)}`);
                    }
                });
            }
            
            // Check for nested outlines (folders)
            if (node.outline) {
                // It's a folder (has children)
                const folderName = text || 'Unnamed Folder';
                
                // Get or create folder
                let currentFolderId: string;
                const existingFolder = db.prepare('SELECT id FROM folders WHERE name = ?').get(folderName) as any;
                
                if (existingFolder) {
                    currentFolderId = existingFolder.id;
                } else {
                    currentFolderId = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    db.prepare('INSERT INTO folders (id, name, created_at) VALUES (?, ?, ?)')
                        .run(currentFolderId, folderName, new Date().toISOString());
                }

                traverse(node.outline, currentFolderId);
            }
        }

        traverse(outlines);

        job.total = actions.length;

        // Execute actions
        for (let i = 0; i < actions.length; i++) {
            actions[i]();
            job.current = i + 1;
            
            // Yield every 50 items to not block event loop
            if (i % 50 === 0) await new Promise(r => setImmediate(r));
        }

        job.status = 'completed';

    } catch (e) {
        job.status = 'failed';
        job.errors.push(e instanceof Error ? e.message : 'Unknown error');
    }
}
