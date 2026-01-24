import OpenAI from 'openai';
import type { Database } from 'better-sqlite3';
import logger from '../utils/logger.js';

export class OpenAIService {
    private client: OpenAI | null = null;
    // Using GPT-4o Mini - excellent balance of quality, speed, and cost
    private readonly modelName = 'gpt-4o-mini';

    constructor(apiKey?: string) {
        if (apiKey) {
            this.initialize(apiKey);
        }
    }

    private initialize(apiKey: string) {
        this.client = new OpenAI({
            apiKey: apiKey,
        });
    }

    /**
     * Get API key from database settings or environment
     */
    private async getApiKey(db: Database): Promise<string | null> {
        try {
            const dbKey = db.prepare('SELECT value FROM meta WHERE key = ?').get('openai_api_key') as any;
            if (dbKey?.value) {
                return dbKey.value;
            }
        } catch (err) {
            logger.debug('No OpenAI API key in database');
        }

        // Fall back to environment variable
        return process.env.OPENAI_API_KEY || null;
    }

    /**
     * Ensure client is initialized with the latest API key
     */
    private async ensureInitialized(db: Database): Promise<void> {
        const apiKey = await this.getApiKey(db);

        if (!apiKey) {
            throw new Error('OpenAI API key not configured. Please set it in Settings → AI.');
        }

        // Always reinitialize to ensure fresh key usage
        this.initialize(apiKey);
    }

    /**
     * Summarize an article
     */
    async summarizeArticle(db: Database, title: string, content: string): Promise<string> {
        await this.ensureInitialized(db);

        // Limit content to avoid token limits (GPT-4o Mini has 128K context window)
        const safeContent = content.substring(0, 120000);

        try {
            const completion = await this.client!.chat.completions.create({
                model: this.modelName,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful reading assistant. Provide concise, informative article summaries in markdown format with a TL;DR and bullet points.'
                    },
                    {
                        role: 'user',
                        content: `Summarize this article:

**Title:** ${title}

**Content:**
${safeContent}

Format: Start with a one-sentence TL;DR, then provide 3-5 bullet points of key takeaways. Use markdown.`
                    }
                ],
                temperature: 0.7,
                max_tokens: 500,
            });

            return completion.choices[0]?.message?.content || 'Summary not available';
        } catch (error) {
            logger.error({ err: error, title }, 'OpenAI summarization failed');
            throw new Error('Failed to generate summary with OpenAI');
        }
    }

    /**
     * Generate content recommendations based on reading history
     */
    async generateRecommendations(
        db: Database,
        readingHistory: Array<{ title: string; content?: string }>,
        limit: number = 5
    ): Promise<Array<{ title: string; reason: string; confidence: number }>> {
        await this.ensureInitialized(db);

        const historyText = readingHistory
            .slice(0, 20)
            .map(item => `- ${item.title}`)
            .join('\n');

        try {
            const completion = await this.client!.chat.completions.create({
                model: this.modelName,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a content recommendation expert. Analyze reading patterns and suggest relevant topics.'
                    },
                    {
                        role: 'user',
                        content: `Based on this reading history, suggest ${limit} article topics or feeds the user might enjoy:

**Reading History:**
${historyText}

Return ONLY a JSON array (no markdown, no code blocks) with this format:
[
  {
    "title": "Recommended topic or feed",
    "reason": "Why this matches their interests",
    "confidence": 0.85
  }
]`
                    }
                ],
                temperature: 0.8,
                max_tokens: 800,
                response_format: { type: 'json_object' }
            });

            const text = completion.choices[0]?.message?.content || '[]';

            // Parse JSON response
            let cleaned = text.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }

            const parsed = JSON.parse(cleaned);
            const recommendations = parsed.recommendations || parsed;
            return Array.isArray(recommendations) ? recommendations.slice(0, limit) : [];
        } catch (error) {
            logger.error({ err: error }, 'OpenAI recommendations failed');
            return [];
        }
    }

    /**
     * Check if service is available (has API key configured)
     */
    async isAvailable(db: Database): Promise<boolean> {
        const apiKey = await this.getApiKey(db);
        return apiKey !== null;
    }

    getModelName(): string {
        return this.modelName;
    }
}

// Singleton instance
export const openaiAI = new OpenAIService();
