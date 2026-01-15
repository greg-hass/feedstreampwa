
import { URL } from 'url';
import logger from '../utils/logger.js';

export interface Discussion {
    source: 'hackernews' | 'reddit';
    title: string;
    url: string;
    score: number;
    commentsCount: number;
    createdAt: string;
    author: string;
    subreddit?: string;
}

function normalizeUrl(url: string): string {
    try {
        const u = new URL(url);
        // Remove tracking params
        const params = u.searchParams;
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid'].forEach(p => params.delete(p));
        // Remove hash
        u.hash = '';
        return u.toString();
    } catch {
        return url;
    }
}

export async function findDiscussions(url: string): Promise<Discussion[]> {
    const cleanUrl = normalizeUrl(url);
    const results: Discussion[] = [];

    await Promise.allSettled([
        searchHackerNews(cleanUrl).then(r => results.push(...r)),
        searchReddit(cleanUrl).then(r => results.push(...r))
    ]);
    
    // Sort by score/engagement
    return results.sort((a, b) => (b.score + b.commentsCount) - (a.score + a.commentsCount));
}

async function searchHackerNews(url: string): Promise<Discussion[]> {
    try {
        // Search by URL
        const res = await fetch(`http://hn.algolia.com/api/v1/search?query=${encodeURIComponent(url)}&restrictSearchableAttributes=url&tags=story`);
        if (!res.ok) return [];
        const data = await res.json() as any;
        return (data.hits || []).map((hit: any) => ({
            source: 'hackernews',
            title: hit.title,
            url: `https://news.ycombinator.com/item?id=${hit.objectID}`,
            score: hit.points,
            commentsCount: hit.num_comments,
            createdAt: hit.created_at,
            author: hit.author
        }));
    } catch (e) {
        logger.error({ err: e }, 'HN Search error');
        return [];
    }
}

async function searchReddit(url: string): Promise<Discussion[]> {
    try {
        // info.json?url=... finds posts with that link
        // User agent is required for Reddit API
        const res = await fetch(`https://www.reddit.com/api/info.json?url=${encodeURIComponent(url)}`, {
             headers: { 'User-Agent': 'FeedStreamPWA/1.0' }
        });
        if (!res.ok) return [];
        const data = await res.json() as any;
        const posts = data.data?.children || [];
        
        return posts.map((child: any) => {
            const p = child.data;
            return {
                source: 'reddit',
                title: p.title,
                url: `https://www.reddit.com${p.permalink}`,
                score: p.score,
                commentsCount: p.num_comments,
                createdAt: new Date(p.created_utc * 1000).toISOString(),
                author: p.author,
                subreddit: p.subreddit
            };
        });
    } catch (e) {
        logger.error({ err: e }, 'Reddit Search error'); 
        return [];
    }
}
