import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Database } from 'better-sqlite3';
import logger from '../utils/logger.js';

export class GeminiAIService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;
    // Using Gemini 2.0 Flash - the latest stable flash model
    private readonly modelName = 'gemini-2.0-flash-exp';

    constructor(apiKey?: string) {
        if (apiKey) {
            this.initialize(apiKey);
        }
    }

    private initialize(apiKey: string) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({
            model: this.modelName,
            generationConfig: {
                temperature: 0.7,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 2048,
            }
        });
    }

    /**
     * Get API key from database settings or environment
     */
    private async getApiKey(db: Database): Promise<string | null> {
        try {
            const dbKey = db.prepare('SELECT value FROM meta WHERE key = ?').get('gemini_api_key') as any;
            if (dbKey?.value) {
                return dbKey.value;
            }
        } catch (err) {
            logger.debug('No Gemini API key in database');
        }

        // Fall back to environment variable
        return process.env.GEMINI_API_KEY || null;
    }

    /**
     * Ensure model is initialized with the latest API key
     */
    private async ensureInitialized(db: Database): Promise<void> {
        const apiKey = await this.getApiKey(db);

        if (!apiKey) {
            throw new Error('Gemini API key not configured. Please set it in Settings → AI.');
        }

        // Always reinitialize to ensure fresh key usage
        this.initialize(apiKey);
    }

    /**
     * Summarize an article
     */
    async summarizeArticle(db: Database, title: string, content: string): Promise<string> {
        await this.ensureInitialized(db);

        // Limit content to avoid token limits
        const safeContent = content.substring(0, 100000);

        const prompt = `You are a helpful reading assistant. Summarize the following article in a concise, clear format.

Start with a brief TL;DR (one sentence), followed by 3-5 bullet points highlighting the most important takeaways.

Use markdown formatting for the summary.

**Title:** ${title}

**Article Content:**
${safeContent}

Provide a clear, informative summary that captures the essence of the article.`;

        try {
            const result = await this.model!.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            logger.error({ err: error, title }, 'Gemini summarization failed');
            throw new Error('Failed to generate summary with Gemini');
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

        const prompt = `Based on this reading history, suggest ${limit} article topics or feeds the user might enjoy:

**Reading History:**
${historyText}

Return ONLY a JSON array of recommendations with this format:
[
  {
    "title": "Recommended topic or feed",
    "reason": "Why this matches their interests",
    "confidence": 0.85
  }
]

No markdown code blocks, just the JSON array.`;

        try {
            const result = await this.model!.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse JSON response
            let cleaned = text.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
            }

            const recommendations = JSON.parse(cleaned);
            return Array.isArray(recommendations) ? recommendations.slice(0, limit) : [];
        } catch (error) {
            logger.error({ err: error }, 'Gemini recommendations failed');
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
export const geminiAI = new GeminiAIService();
