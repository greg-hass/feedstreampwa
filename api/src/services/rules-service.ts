import { Database } from 'better-sqlite3';

export interface Rule {
    id: string;
    name?: string;
    keyword: string;
    field: 'title' | 'content' | 'author' | 'any';
    action: 'mark_read' | 'star' | 'delete';
    feed_url?: string;
    is_active: number;
}

export function applyRules(db: Database, item: any, feedUrl: string): { isRead?: boolean, isStarred?: boolean, shouldSkip?: boolean } {
    // Ideally cache this statement or result, but simple select is fast enough for batch operations.
    const rules = db.prepare('SELECT * FROM auto_rules WHERE is_active = 1 AND (feed_url IS NULL OR feed_url = ?)').all(feedUrl) as Rule[];
    
    let isRead = false;
    let isStarred = false;
    let shouldSkip = false;

    if (rules.length === 0) return {};

    for (const rule of rules) {
        let textToCheck = '';
        if (rule.field === 'title') textToCheck = item.title || '';
        else if (rule.field === 'content') textToCheck = (item.summary || '') + ' ' + (item.content || '');
        else if (rule.field === 'author') textToCheck = item.author || '';
        else if (rule.field === 'any') textToCheck = `${item.title || ''} ${item.summary || ''} ${item.content || ''} ${item.author || ''}`;
        
        if (textToCheck.toLowerCase().includes(rule.keyword.toLowerCase())) {
             if (rule.action === 'mark_read') isRead = true;
             if (rule.action === 'star') isStarred = true;
             if (rule.action === 'delete') shouldSkip = true;
        }
    }
    
    return { isRead, isStarred, shouldSkip };
}
