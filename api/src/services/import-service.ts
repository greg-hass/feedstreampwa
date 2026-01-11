import { XMLParser } from 'fast-xml-parser';
import { getDatabase } from '../db/connection.js';
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

        const db = getDatabase();
        const actions: Array<() => void> = [];

        // Recursive function to traverse and build actions
        // We do this to count 'total' accurately first
        function traverse(node: any, folderId: string | null = null) {
            // Handle array of outlines
            if (Array.isArray(node)) {
                for (const item of node) {
                    traverse(item, folderId);
                }
                return;
            }

            // Single node
            const type = node.type || '';
            const text = node.text || node.title || '';
            const xmlUrl = node.xmlUrl || '';

            if (xmlUrl) {
                // It's a feed
                actions.push(() => {
                    job.currentName = text || xmlUrl;
                    
                    try {
                        // Check if feed exists
                        const existing = db.prepare('SELECT id, url FROM feeds WHERE url = ?').get(xmlUrl);
                        let feedUrl = xmlUrl;

                        if (!existing) {
                            db.prepare(`
                                INSERT INTO feeds (url, kind, title, site_url, icon_url, custom_title, last_status)
                                VALUES (?, 'generic', ?, ?, NULL, NULL, 0)
                            `).run(xmlUrl, text, node.htmlUrl || null);
                            job.result.added++;
                        } else {
                            feedUrl = (existing as any).url;
                            job.result.skipped++;
                        }

                        // Add to folder if applicable
                        if (folderId) {
                            db.prepare('INSERT OR IGNORE INTO folder_feeds (folder_id, feed_url) VALUES (?, ?)')
                                .run(folderId, feedUrl);
                        }
                    } catch (e) {
                        job.result.failed++;
                        job.errors.push(`Failed to import ${xmlUrl}: ${e instanceof Error ? e.message : String(e)}`);
                    }
                });
            } else if (node.outline) {
                // It's a folder (has children)
                // In standard OPML, a folder is an outline with no xmlUrl but has children
                
                // 1. Create Folder
                const folderName = text;
                let currentFolderId = folderId;

                // Create folder action (immediate, not deferred, to get ID for children)
                // Actually, we can defer it if we maintain state, but simpler to run logic now?
                // No, we want to count total actions.
                // We'll wrap the *creation* in an action too? 
                // Or just assume folders are cheap and fast.
                // Let's create folders immediately during traversal? 
                // No, "processImport" is async. traverse is sync.
                // We need to queue the folder creation to track progress properly?
                // Actually, folder creation is fast. Feed import is fast (DB only).
                // The main issue with the old one was it wasn't reporting *progress*.
                
                // Let's create the folder immediately to get the ID for children.
                const existingFolder = db.prepare('SELECT id FROM folders WHERE name = ?').get(folderName);
                let newFolderId;
                
                if (existingFolder) {
                    newFolderId = (existingFolder as any).id;
                } else {
                    const res = db.prepare('INSERT INTO folders (name) VALUES (?)').run(folderName);
                    newFolderId = res.lastInsertRowid.toString();
                }

                traverse(node.outline, newFolderId);
            }
        }

        traverse(outlines);

        job.total = actions.length;

        // Execute actions with slight delay to allow UI updates if needed, 
        // but mainly just run them.
        for (let i = 0; i < actions.length; i++) {
            actions[i]();
            job.current = i + 1;
            
            // Artificial delay for small lists so user sees the bar?
            // No, speed is better.
            
            // Yield every 50 items to not block event loop
            if (i % 50 === 0) await new Promise(r => setImmediate(r));
        }

        job.status = 'completed';

    } catch (e) {
        job.status = 'failed';
        job.errors.push(e instanceof Error ? e.message : 'Unknown error');
    }
}
