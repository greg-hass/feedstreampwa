// Feed search helper functions for discovering RSS feeds, YouTube channels, and Reddit subreddits

export interface SearchResult {
    title: string;
    url: string;
    description: string;
    type: 'rss' | 'youtube' | 'reddit';
    thumbnail?: string;
}

/**
 * Search for YouTube channels and return RSS feed URLs
 */
export async function searchYouTube(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Try common YouTube channel URL patterns
    const cleanQuery = query.trim().toLowerCase().replace(/\s+/g, '');

    // Pattern 1: Direct channel name (e.g., @mkbhd)
    if (cleanQuery.startsWith('@') || !cleanQuery.includes(' ')) {
        const channelHandle = cleanQuery.startsWith('@') ? cleanQuery : `@${cleanQuery}`;
        results.push({
            title: `YouTube: ${channelHandle}`,
            url: `https://www.youtube.com/${channelHandle}`,
            description: `Subscribe to ${channelHandle}'s channel`,
            type: 'youtube'
        });
    }

    // Pattern 2: Try as channel name with spaces replaced
    const channelName = query.trim().replace(/\s+/g, '').toLowerCase();
    if (channelName !== cleanQuery) {
        results.push({
            title: `YouTube: @${channelName}`,
            url: `https://www.youtube.com/@${channelName}`,
            description: `Subscribe to @${channelName}'s channel`,
            type: 'youtube'
        });
    }

    return results.slice(0, 3); // Limit to top 3
}

/**
 * Search for Reddit subreddits and return RSS feed URLs
 */
export async function searchReddit(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Clean the query
    const cleanQuery = query.trim().toLowerCase().replace(/^r\//, '').replace(/\s+/g, '');

    if (!cleanQuery) return results;

    // Direct subreddit match
    const subredditUrl = `https://www.reddit.com/r/${cleanQuery}/.rss`;
    results.push({
        title: `r/${cleanQuery}`,
        url: subredditUrl,
        description: `Subscribe to r/${cleanQuery} subreddit`,
        type: 'reddit'
    });

    // Try with underscores if query has spaces
    if (query.includes(' ')) {
        const withUnderscores = query.trim().replace(/\s+/g, '_').toLowerCase();
        results.push({
            title: `r/${withUnderscores}`,
            url: `https://www.reddit.com/r/${withUnderscores}/.rss`,
            description: `Subscribe to r/${withUnderscores} subreddit`,
            type: 'reddit'
        });
    }

    return results.slice(0, 2); // Limit to top 2
}

/**
 * Search for RSS feeds using common patterns
 */
export async function searchRSS(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Clean the query
    const cleanQuery = query.trim().toLowerCase().replace(/\s+/g, '');

    if (!cleanQuery) return results;

    // Common RSS feed patterns
    const commonDomains = [
        { pattern: 'omgubuntu', url: 'https://www.omgubuntu.co.uk/feed', title: 'OMG! Ubuntu!' },
        { pattern: 'techcrunch', url: 'https://techcrunch.com/feed/', title: 'TechCrunch' },
        { pattern: 'arstechnica', url: 'https://feeds.arstechnica.com/arstechnica/index', title: 'Ars Technica' },
        { pattern: 'theverge', url: 'https://www.theverge.com/rss/index.xml', title: 'The Verge' },
        { pattern: 'wired', url: 'https://www.wired.com/feed/rss', title: 'Wired' },
        { pattern: 'engadget', url: 'https://www.engadget.com/rss.xml', title: 'Engadget' },
        { pattern: 'hackernews', url: 'https://news.ycombinator.com/rss', title: 'Hacker News' },
        { pattern: 'slashdot', url: 'http://rss.slashdot.org/Slashdot/slashdotMain', title: 'Slashdot' },
        { pattern: 'reddit', url: 'https://www.reddit.com/.rss', title: 'Reddit Frontpage' },
    ];

    // Check for exact matches
    for (const domain of commonDomains) {
        if (cleanQuery.includes(domain.pattern)) {
            results.push({
                title: domain.title,
                url: domain.url,
                description: `Subscribe to ${domain.title} RSS feed`,
                type: 'rss'
            });
        }
    }

    // Try common URL patterns
    if (results.length === 0) {
        const possibleUrls = [
            `https://${cleanQuery}.com/feed`,
            `https://${cleanQuery}.com/rss`,
            `https://www.${cleanQuery}.com/feed`,
            `https://www.${cleanQuery}.com/rss`,
        ];

        for (const url of possibleUrls.slice(0, 2)) {
            results.push({
                title: `${query} RSS Feed`,
                url: url,
                description: `Possible RSS feed for ${query}`,
                type: 'rss'
            });
        }
    }

    return results.slice(0, 3); // Limit to top 3
}

/**
 * Search for feeds across all types
 */
export async function searchFeeds(query: string, type: 'all' | 'rss' | 'youtube' | 'reddit' = 'all'): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    if (type === 'all' || type === 'rss') {
        const rssResults = await searchRSS(query);
        allResults.push(...rssResults);
    }

    if (type === 'all' || type === 'youtube') {
        const youtubeResults = await searchYouTube(query);
        allResults.push(...youtubeResults);
    }

    if (type === 'all' || type === 'reddit') {
        const redditResults = await searchReddit(query);
        allResults.push(...redditResults);
    }

    return allResults;
}
