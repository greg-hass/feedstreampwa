// Feed search helper functions for discovering RSS feeds, YouTube channels, and Reddit subreddits

export interface SearchResult {
    title: string;
    url: string;
    description: string;
    type: 'rss' | 'youtube' | 'reddit';
    thumbnail?: string;
    site_url?: string;
}

const TIMEOUT_MS = 3000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchWithTimeout(url: string, options: RequestInit = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': USER_AGENT,
                ...options.headers
            }
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

async function checkFeedUrl(url: string): Promise<boolean> {
    try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 
                    'User-Agent': USER_AGENT,
                    'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'
                },
                signal: controller.signal
            });
            
            clearTimeout(id);
            if (!response.ok) return false;

            const type = response.headers.get('content-type')?.toLowerCase() || '';
            
            // Check for XML/RSS/Atom content types
            if (type.includes('xml') || type.includes('rss') || type.includes('atom')) {
                return true;
            }

            // If text/plain, it might still be a feed, but we'll skip for now to avoid false positives
            return false;
        } catch (e) {
            clearTimeout(id);
            return false;
        }
    } catch {
        return false;
    }
}

/**
 * Search for YouTube channels and return RSS feed URLs
 */
export async function searchYouTube(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const cleanQuery = query.trim();

    // Determine the channel URL to scrape
    let channelUrl = '';
    let handle = '';

    if (cleanQuery.startsWith('http')) {
        channelUrl = cleanQuery;
    } else if (cleanQuery.startsWith('@')) {
        handle = cleanQuery;
        channelUrl = `https://www.youtube.com/${handle}`;
    } else {
        // Assume it's a handle or search query. 
        // Since we can't easily search YT without an API key, we'll assume it's a handle if it has no spaces, 
        // or try to construct a handle.
        handle = cleanQuery.includes(' ') ? `@${cleanQuery.replace(/\s+/g, '')}` : `@${cleanQuery}`;
        channelUrl = `https://www.youtube.com/${handle}`;
    }

    try {
        const response = await fetchWithTimeout(channelUrl);
        if (response.ok) {
            const text = await response.text();
            
            // Extract Channel ID
            const channelIdMatch = text.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/);
            const channelId = channelIdMatch ? channelIdMatch[1] : null;

            // Extract Title
            const titleMatch = text.match(/<title>([^<]+) - YouTube<\/title>/i) || text.match(/"title":"([^"]+)"/);
            const title = titleMatch ? titleMatch[1] : cleanQuery;

            // Extract Avatar (Thumbnail)
            // Look for og:image or similar
            const imageMatch = text.match(/<meta property="og:image" content="([^"]+)"/);
            const thumbnail = imageMatch ? imageMatch[1] : undefined;

            if (channelId) {
                results.push({
                    title: title,
                    url: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
                    description: `YouTube Channel: ${title}`,
                    type: 'youtube',
                    thumbnail: thumbnail,
                    site_url: channelUrl
                });
            }
        }
    } catch (e) {
        // Fallback if scrape fails (e.g. timeout): Return a result if it looked like a handle, 
        // but warn it's unverified or just return the handle-based URL if we can't get the ID.
        // Actually, without the ID, we can't make a valid RSS feed. 
        // So we might return nothing or a "best effort" that might fail later.
        // Let's return nothing to avoid "Possible" spam that doesn't work.
    }

    return results;
}

/**
 * Search for Reddit subreddits and return RSS feed URLs
 */
export async function searchReddit(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    
    // Clean the query: remove r/ prefix, keep spaces but valid subreddits usually don't have spaces (except older ones that redirect?)
    // Actually subreddits don't have spaces.
    const cleanQuery = query.trim().replace(/^r\//i, '').replace(/\s+/g, '');

    if (!cleanQuery) return results;

    const subredditUrl = `https://www.reddit.com/r/${cleanQuery}/.rss`;
    
    // Quick verify
    try {
        const isValid = await checkFeedUrl(subredditUrl);
        if (isValid) {
            results.push({
                title: `r/${cleanQuery}`,
                url: subredditUrl,
                description: `Reddit Subreddit`,
                type: 'reddit',
                thumbnail: 'https://www.redditstatic.com/desktop2x/img/favicon/favicon-96x96.png',
                site_url: `https://www.reddit.com/r/${cleanQuery}`
            });
        }
    } catch {
        // Ignore check failures, maybe just push it if we want to be lenient
    }

    return results;
}

/**
 * Search for RSS feeds using common patterns
 */
export async function searchRSS(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const cleanQuery = query.trim().toLowerCase();
    
    // If it looks like a URL, check it directly
    if (cleanQuery.includes('.') && !cleanQuery.includes(' ')) {
        let url = cleanQuery;
        if (!url.startsWith('http')) {
            url = `https://${url}`;
        }

        // Potential paths to check
        const candidates = [
            url,
            url.endsWith('/') ? `${url}feed` : `${url}/feed`,
            url.endsWith('/') ? `${url}rss` : `${url}/rss`,
            url.endsWith('/') ? `${url}rss.xml` : `${url}/rss.xml`,
        ];

        const checks = await Promise.allSettled(candidates.map(async (u) => {
            const isFeed = await checkFeedUrl(u);
            return isFeed ? u : null;
        }));

        for (const check of checks) {
            if (check.status === 'fulfilled' && check.value) {
                const domain = new URL(check.value).hostname;
                results.push({
                    title: domain,
                    url: check.value,
                    description: `Feed from ${domain}`,
                    type: 'rss',
                    thumbnail: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
                    site_url: `https://${domain}`
                });
                return results; // Return early if we found a direct match
            }
        }
    }

    // Keyword search - check common domains
    const commonDomains = [
        { pattern: 'techcrunch', url: 'https://techcrunch.com/feed/', title: 'TechCrunch' },
        { pattern: 'verge', url: 'https://www.theverge.com/rss/index.xml', title: 'The Verge' },
        { pattern: 'wired', url: 'https://www.wired.com/feed/rss', title: 'Wired' },
        { pattern: 'engadget', url: 'https://www.engadget.com/rss.xml', title: 'Engadget' },
        { pattern: 'hackernews', url: 'https://news.ycombinator.com/rss', title: 'Hacker News' },
    ];

    for (const domain of commonDomains) {
        if (cleanQuery.includes(domain.pattern)) {
            const d = new URL(domain.url).hostname;
            results.push({
                title: domain.title,
                url: domain.url,
                description: `Verified Feed`,
                type: 'rss',
                thumbnail: `https://www.google.com/s2/favicons?domain=${d}&sz=64`,
                site_url: `https://${d}`
            });
        }
    }

    // Heuristic: try domain.com/feed
    // Only if the query is a simple word or domain-like string
    const domainGuess = cleanQuery.replace(/\s+/g, '');
    if (domainGuess.length > 3 && /^[a-z0-9.-]+$/.test(domainGuess)) {
        const possibleUrl = `https://${domainGuess}.com/feed`;
        const isValid = await checkFeedUrl(possibleUrl);
        
        if (isValid) {
            results.push({
                title: `${query} Feed`,
                url: possibleUrl,
                description: `Detected Feed`,
                type: 'rss',
                thumbnail: `https://www.google.com/s2/favicons?domain=${domainGuess}.com&sz=64`,
                site_url: `https://${domainGuess}.com`
            });
        }
    }

    return results;
}

/**
 * Search for feeds across all types
 */
export async function searchFeeds(query: string, type: 'all' | 'rss' | 'youtube' | 'reddit' = 'all'): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];
    
    // Execute searches in parallel
    const promises: Promise<SearchResult[]>[] = [];

    if (type === 'all' || type === 'rss') {
        promises.push(searchRSS(query));
    }

    if (type === 'all' || type === 'youtube') {
        promises.push(searchYouTube(query));
    }

    if (type === 'all' || type === 'reddit') {
        promises.push(searchReddit(query));
    }

    const results = await Promise.allSettled(promises);
    
    for (const result of results) {
        if (result.status === 'fulfilled') {
            allResults.push(...result.value);
        }
    }

    return allResults;
}
