import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/index.js';
import type { Database } from 'better-sqlite3';
import logger from '../utils/logger.js';

export interface FeedRecommendation {
    title: string;
    url: string;
    description: string;
    category: string;
    reason: string;
    confidence: number; // 0-1
}

export class AIRecommendationService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;
    private readonly modelName = 'gemini-2.5-flash';

    constructor() {
        if (env.GEMINI_API_KEY) {
            this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
            this.model = this.genAI.getGenerativeModel({ model: this.modelName });
        }
    }

    private loadRecommendationData(db: Database): {
        feeds: Array<{ url: string; title: string; type: string }>;
        readingHistory: Array<{ title: string; summary: string | null; feed_title: string; source: string; is_starred: number }>;
    } {
        const feeds = db.prepare(`
            SELECT 
                url, 
                COALESCE(custom_title, title, url) as title,
                kind as type
            FROM feeds
        `).all() as Array<{ url: string; title: string; type: string }>;

        const readingHistory = db.prepare(`
            SELECT 
                i.title,
                i.summary,
                COALESCE(f.custom_title, f.title, f.url) as feed_title,
                i.source,
                i.is_starred
            FROM items i
            INNER JOIN feeds f ON i.feed_url = f.url
            WHERE i.is_read = 1 OR i.is_starred = 1
            ORDER BY 
                i.is_starred DESC,
                COALESCE(i.updated, i.published, i.created_at) DESC
            LIMIT 50
        `).all() as Array<{
            title: string;
            summary: string | null;
            feed_title: string;
            source: string;
            is_starred: number;
        }>;

        return { feeds, readingHistory };
    }

    getModelName(): string {
        return this.modelName;
    }

    async getPromptPreview(db: Database, limit: number = 5): Promise<string> {
        const { feeds, readingHistory } = this.loadRecommendationData(db);
        return this.buildRecommendationPrompt(feeds, readingHistory, limit);
    }

    /**
     * Analyze user's reading patterns and generate feed recommendations
     */
    async generateRecommendations(db: Database, limit: number = 5): Promise<FeedRecommendation[]> {
        // Try to get API key from database first (GUI-configured), then environment variable
        let apiKey = env.GEMINI_API_KEY;
        
        try {
            const dbKey = db.prepare('SELECT value FROM meta WHERE key = ?').get('gemini_api_key') as any;
            if (dbKey?.value) {
                apiKey = dbKey.value;
            }
        } catch (err) {
            // Database doesn't have the key, use environment variable
        }

        // Initialize model with the API key if not already initialized or if key changed
        if (!apiKey) {
            throw new Error('Gemini API key not configured. Please set it in Settings or as GEMINI_API_KEY environment variable.');
        }

        if (!this.genAI || !this.model) {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: this.modelName });
        }

        const { feeds, readingHistory } = this.loadRecommendationData(db);

        // Build the prompt for Gemini
        const prompt = this.buildRecommendationPrompt(feeds, readingHistory, limit);

        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse the JSON response
            const recommendations = this.parseRecommendations(text);
            const existingUrls = new Set(
                currentFeeds.map((feed) => feed.url.toLowerCase())
            );
            const uniqueRecommendations = recommendations.filter(
                (rec) => !existingUrls.has(rec.url.toLowerCase())
            );
            return uniqueRecommendations.slice(0, limit);
        } catch (error) {
            logger.error({ err: error }, 'Error generating recommendations');
            const message = error instanceof Error ? error.message : 'Failed to generate feed recommendations';
            throw new Error(message);
        }
    }

    private buildRecommendationPrompt(
        currentFeeds: Array<{ url: string; title: string; type: string }>,
        readingHistory: Array<{ title: string; summary: string | null; feed_title: string; source: string; is_starred: number }>,
        limit: number
    ): string {
        const feedList = currentFeeds.map(f => `- ${f.title} (${f.type}): ${f.url}`).join('\n');
        
        const starredArticles = readingHistory
            .filter(a => a.is_starred === 1)
            .slice(0, 10)
            .map(a => `- "${a.title}" from ${a.feed_title}`)
            .join('\n');

        const recentReads = readingHistory
            .slice(0, 20)
            .map(a => `- "${a.title}" from ${a.feed_title}`)
            .join('\n');

        return `You are an expert feed curator. Analyze the user's reading patterns and recommend NEW subscriptions they might enjoy.

**Current Subscribed Feeds:**
${feedList || 'None yet'}

**Starred Articles (High Interest):**
${starredArticles || 'None yet'}

**Recent Reading History:**
${recentReads || 'None yet'}

Based on this data, recommend ${limit} NEW feeds (RSS/Atom, YouTube channel feeds, Reddit subreddit feeds, podcast feeds) that:
1. Are NOT already in their subscribed feeds
2. Match their interests based on reading patterns
3. Are high-quality, actively maintained feeds
4. Cover diverse but related topics
5. Include a mix of sources (blogs, news sites, YouTube channels, podcasts, Reddit)

For each recommendation, provide:
- title: The feed name
- url: The feed URL (must be a valid feed URL, not a website URL)
- description: Brief description of the feed
- category: One of: technology, news, entertainment, science, business, lifestyle, sports, other
- reason: Why this feed matches their interests (2-3 sentences)
- confidence: A number between 0 and 1 indicating how confident you are this is a good match

Examples of valid feed URLs:
- RSS/Atom: https://example.com/feed.xml
- YouTube channel: https://www.youtube.com/feeds/videos.xml?channel_id=UCxxxx
- Reddit subreddit: https://www.reddit.com/r/technology/.rss
- Podcast: https://feeds.simplecast.com/xxxx

Return ONLY a valid JSON array of recommendations. No markdown, no code blocks, just the JSON array.

Example format:
[
  {
    "title": "Example Feed",
    "url": "https://example.com/feed.xml",
    "description": "A great feed about...",
    "category": "technology",
    "reason": "Based on your interest in...",
    "confidence": 0.85
  }
]`;
    }

    private parseRecommendations(text: string): FeedRecommendation[] {
        try {
            // Remove markdown code blocks if present
            let cleaned = text.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }

            const parsed = JSON.parse(cleaned);
            
            if (!Array.isArray(parsed)) {
                throw new Error('Response is not an array');
            }

            // Validate and clean recommendations
            return parsed
                .filter(rec => 
                    rec.title && 
                    rec.url && 
                    rec.description && 
                    rec.category && 
                    rec.reason &&
                    typeof rec.confidence === 'number'
                )
                .map(rec => ({
                    title: rec.title,
                    url: rec.url,
                    description: rec.description,
                    category: rec.category,
                    reason: rec.reason,
                    confidence: Math.max(0, Math.min(1, rec.confidence))
                }));
        } catch (error) {
            logger.error({ err: error }, 'Error parsing recommendations');
            logger.error({ text }, 'Raw text');
            return [];
        }
    }

    async summarizeArticle(db: Database, title: string, content: string): Promise<string> {
        // Init logic
        let apiKey = env.GEMINI_API_KEY;
        try {
            const dbKey = db.prepare('SELECT value FROM meta WHERE key = ?').get('gemini_api_key') as any;
            if (dbKey?.value) apiKey = dbKey.value;
        } catch (e) {}
        
        if (!apiKey) throw new Error('Gemini API key not configured');

        // Always re-init to ensure fresh key usage if it changed
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const safeContent = content.substring(0, 100000); 

        const prompt = `
        You are a helpful reading assistant. Summarize the following article in a concise, clear format.
        Start with a 1-sentence "TL;DR", followed by 3-5 bullet points of the most important takeaways.
        Use markdown formatting.
        
        Title: ${title}
        
        Content:
        ${safeContent}
        `;

        const result = await this.model.generateContent(prompt);
        return result.response.text();
    }

    /**
     * Check if AI recommendations are available
     */
    isAvailable(): boolean {
        return this.model !== null;
    }
}

// Singleton instance
export const aiRecommendationService = new AIRecommendationService();
