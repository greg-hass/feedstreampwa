import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/client.js';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import sanitizeHtml from 'sanitize-html';
import { ReaderQuerySchema, PurgeReaderSchema } from '../types/schemas.js';

const FETCH_TIMEOUT_MS = parseInt(process.env.FETCH_TIMEOUT_MS || '12000', 10);
const READER_CACHE_TTL_HOURS = 168; // 7 days

// Helper: Check if reader cache entry is fresh
function isCacheFresh(updatedAtIso: string): boolean {
    const updatedAt = new Date(updatedAtIso).getTime();
    const now = Date.now();
    const ttlMs = READER_CACHE_TTL_HOURS * 60 * 60 * 1000;
    return now - updatedAt < ttlMs;
}

// Sanitize-html options for reader content
const sanitizeOptions: sanitizeHtml.IOptions = {
    allowedTags: ['p', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'em', 'strong', 'hr', 'br', 'h2', 'h3'],
    allowedAttributes: {
        'a': ['href', 'title']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    disallowedTagsMode: 'discard'
};

// Helper: Normalize and resolve absolute URLs
function normalizeUrl(url: string, baseUrl?: string): string {
    try {
        if (baseUrl) {
            return new URL(url, baseUrl).href;
        }
        return new URL(url).href;
    } catch {
        return url;
    }
}

// Helper: Check if URL is a usable image (not data URI, not tiny icon)
function isUsableImage(src: string): boolean {
    if (!src || src.startsWith('data:')) return false;
    const lower = src.toLowerCase();
    if (lower.includes('icon') || lower.includes('logo') || lower.includes('avatar')) return false;
    return true;
}

export default async function readerRoutes(fastify: FastifyInstance, options: any) {
    // Reader View endpoint with caching and sanitization
    fastify.get('/reader', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = ReaderQuerySchema.safeParse(request.query);
        
        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const targetUrl = result.data.url;

        // Validate URL is http/https
        try {
            const parsed = new URL(targetUrl);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                reply.code(400);
                return { ok: false, error: 'Only http/https URLs are allowed' };
            }
        } catch {
            reply.code(400);
            return { ok: false, error: 'Invalid URL format' };
        }

        try {
            // Check cache first
            const cached = db.prepare(`
                SELECT url, title, byline, excerpt, site_name, image_url, content_html, created_at, updated_at
                FROM reader_cache WHERE url = ?
            `).get(targetUrl) as any;

            if (cached && isCacheFresh(cached.updated_at)) {
                return {
                    ok: true,
                    url: cached.url,
                    title: cached.title,
                    byline: cached.byline,
                    excerpt: cached.excerpt,
                    siteName: cached.site_name,
                    imageUrl: cached.image_url,
                    contentHtml: cached.content_html,
                    fromCache: true
                };
            }

            // Special handling for YouTube videos
            if (targetUrl.includes('youtube.com/watch') || targetUrl.includes('youtu.be/')) {
                let videoId = null;
                if (targetUrl.includes('v=')) {
                    videoId = targetUrl.split('v=')[1]?.split('&')[0];
                } else if (targetUrl.includes('youtu.be/')) {
                    videoId = targetUrl.split('youtu.be/')[1]?.split('?')[0];
                }

                if (videoId) {
                    const embedHtml = `
                        <div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; margin-bottom: 20px;">
                            <iframe
                                src="https://www.youtube.com/embed/${videoId}?autoplay=1"
                                style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowfullscreen>
                            </iframe>
                        </div>
                    `;

                    const result = {
                        ok: true,
                        url: targetUrl,
                        title: 'YouTube Video',
                        byline: null,
                        excerpt: null,
                        siteName: 'YouTube',
                        imageUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
                        contentHtml: embedHtml,
                        fromCache: false
                    };

                    // Cache it
                    const now = new Date().toISOString();
                    db.prepare(`
                        INSERT INTO reader_cache (url, title, byline, excerpt, site_name, image_url, content_html, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(url) DO UPDATE SET
                            title = excluded.title,
                            content_html = excluded.content_html,
                            updated_at = excluded.updated_at
                    `).run(targetUrl, result.title, null, null, 'YouTube', result.imageUrl, embedHtml, now, now);

                    return result;
                }
            }

            // Fetch the page HTML
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Referer': new URL(targetUrl).origin,
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                signal: controller.signal,
                redirect: 'follow'
            });

            clearTimeout(timeout);

            if (!response.ok) {
                fastify.log.warn(`Reader fetch failed for ${targetUrl}: ${response.status} ${response.statusText}`);
                reply.code(response.status);
                return {
                    ok: false,
                    error: `Failed to fetch: ${response.statusText || response.status}`
                };
            }

            const html = await response.text();
            const finalUrl = response.url || targetUrl;

            // Special handling for Reddit posts - extract title from page to avoid "The heart of the internet"
            let redditPostTitle: string | null = null;
            if (targetUrl.includes('reddit.com')) {
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (titleMatch) {
                    let title = titleMatch[1].trim();
                    // Reddit pages often have format "Post Title - Subreddit" or just "Post Title"
                    // Remove Reddit taglines if present
                    title = title.replace(/\s*[:\-–]\s*(Reddit| Dive into anything).*$/i, '');
                    // Remove " - r/" suffix if it's a subreddit name rather than post title
                    title = title.replace(/\s*[:\-–]\s*r\/[^:]+$/i, '');
                    if (title && title !== 'The heart of the internet' && title !== 'Reddit - Dive into anything') {
                        redditPostTitle = title;
                    }
                }
            }

            // Parse with JSDOM
            const dom = new JSDOM(html, { url: finalUrl });
            const document = dom.window.document;

            // Extract og:image BEFORE stripping junk (priority image source)
            let imageUrl: string | null = null;
            const ogImage = document.querySelector('meta[property="og:image"]');
            const twitterImage = document.querySelector('meta[name="twitter:image"]');
            if (ogImage) {
                const content = ogImage.getAttribute('content');
                if (content) imageUrl = normalizeUrl(content, finalUrl);
            } else if (twitterImage) {
                const content = twitterImage.getAttribute('content');
                if (content) imageUrl = normalizeUrl(content, finalUrl);
            }

            // Pre-strip only the most obvious common noise if absolutely necessary
            const noiseSelectors = [
                'noscript', 'form', 'iframe', 'script', 'style'
            ];

            noiseSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach((el: Element) => el.remove());
            });

            // Reddit specific cleaning in reader view
            if (targetUrl.includes('reddit.com')) {
                const redditNoise = [
                    '.reddit-link', '.subreddit-link', '.author-link', 
                    '#header', '#footer', '.comment-count', '.share-button',
                    'div[data-click-id="background"] > div:first-child',
                    'button',
                    'nav', 'aside',
                    '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
                    'header', 'footer',
                    'shreddit-subreddit-header',
                    'shreddit-async-loader',
                    '[slot="credit-bar"]',
                    'faceplate-tracker',
                    '*:not(script):not(style)'
                ];
                
                redditNoise.forEach(sel => {
                    document.querySelectorAll(sel).forEach((el: Element) => el.remove());
                });
                
                const boilerplateTexts = [
                    'Go to selfhosted', 'r/selfhosted', 'Members', 'A place to share, discuss, discover',
                    'Dive into anything', 'Open in app', 'Log in', 'Sign up', 'Get app', 'Get the Reddit app', 'More posts you may like'
                ];
                
                const allElements = document.querySelectorAll('*');
                allElements.forEach((el: Element) => {
                    const text = el.textContent?.trim() || '';
                    if (boilerplateTexts.some(bp => text === bp || text.startsWith(bp))) {
                        el.remove();
                    }
                    // Remove "submitted by /u/..."
                    if (text.match(/^submitted by\s+\/u\//i)) {
                        el.remove();
                    }
                });
            }

            // Clean raw URLs in text (common in Reddit RSS feeds)
            const walker = document.createTreeWalker(document.body, 4); // SHOW_TEXT
            let node;
            while (node = walker.nextNode()) {
                const val = node.nodeValue || '';
                // Check for raw preview.redd.it or i.redd.it links
                if (val.includes('preview.redd.it') || val.includes('i.redd.it')) {
                     // If it's just a URL (possibly with query params), remove it
                     // Matches: http(s)://(preview|i).redd.it/...
                     if (val.trim().match(/^https?:\/\/(preview|i)\.redd\.it\/.+/)) {
                         node.nodeValue = '';
                     }
                }
            }

            // Run Readability
            const reader = new Readability(document);
            let article = reader.parse();

            // Fallback for modern Reddit (shreddit)
            if ((!article || !article.content || article.content.length < 100) && targetUrl.includes('reddit.com')) {
                const shredditPost = document.querySelector('shreddit-post');
                if (shredditPost) {
                    const contentSelectors = [
                        '[slot="post-media-container"]',
                        '.m-none.mb-sm',
                        'div[id^="t3_"]',
                        '.text-neutral-content' 
                    ];

                    let postContent: Element | null = null;
                    for (const sel of contentSelectors) {
                        postContent = shredditPost.querySelector(sel);
                        if (postContent) break;
                    }

                    if (postContent) {
                        fastify.log.info(`Extracted Reddit content via fallback for ${targetUrl}`);
                        article = {
                            title: redditPostTitle || document.title || 'Reddit Post',
                            content: postContent.innerHTML,
                            textContent: postContent.textContent || '',
                            length: postContent.innerHTML.length,
                            excerpt: '',
                            byline: shredditPost.getAttribute('author') || '',
                            dir: '',
                            siteName: 'Reddit',
                            lang: 'en',
                            publishedTime: shredditPost.getAttribute('created-timestamp') || ''
                        };
                    }
                }
            }

            if (!article || !article.content) {
                reply.code(422);
                return {
                    ok: false,
                    error: 'Could not extract readable content'
                };
            }

            // Parse the article content to extract first image (fallback if no og:image)
            const contentDom = new JSDOM(article.content);
            const contentDoc = contentDom.window.document;

            if (!imageUrl) {
                const images = contentDoc.querySelectorAll('img');
                for (const img of Array.from(images)) {
                    const src = (img as HTMLImageElement).getAttribute('src');
                    if (src && isUsableImage(src)) {
                        imageUrl = normalizeUrl(src, finalUrl);
                        break;
                    }
                }
            }

            // Get raw HTML before sanitizing
            const rawHtml = contentDoc.body.innerHTML;

            // Sanitize the final content
            const contentHtml = sanitizeHtml(rawHtml, sanitizeOptions);

            // Build structured response
            const result = {
                ok: true,
                url: finalUrl,
                title: redditPostTitle || article.title || null,
                byline: article.byline || null,
                excerpt: article.excerpt || null,
                siteName: article.siteName || null,
                imageUrl,
                contentHtml,
                fromCache: false
            };

            // Upsert into cache
            const now = new Date().toISOString();
            db.prepare(`
                INSERT INTO reader_cache (url, title, byline, excerpt, site_name, image_url, content_html, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(url) DO UPDATE SET
                    title = excluded.title,
                    byline = excluded.byline,
                    excerpt = excluded.excerpt,
                    site_name = excluded.site_name,
                    image_url = excluded.image_url,
                    content_html = excluded.content_html,
                    updated_at = excluded.updated_at
            `).run(
                finalUrl,
                result.title,
                result.byline,
                result.excerpt,
                result.siteName,
                result.imageUrl,
                result.contentHtml,
                cached?.created_at || now,
                now
            );

            return result;
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: error.message || 'Internal server error'
            };
        }
    });

    // Purge old reader cache entries
    fastify.post('/reader/purge', async (request: FastifyRequest, reply: FastifyReply) => {
        const result = PurgeReaderSchema.safeParse(request.body);
        
        if (!result.success) {
            reply.code(400);
            return {
                ok: false,
                error: result.error.issues[0].message
            };
        }

        const olderThanHours = result.data.olderThanHours || 720; // 30 days default

        try {
            const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000).toISOString();
            const deleteResult = db.prepare(`
                DELETE FROM reader_cache WHERE updated_at < ?
            `).run(cutoff);

            return {
                ok: true,
                deleted: deleteResult.changes
            };
        } catch (error: any) {
            fastify.log.error(error);
            reply.code(500);
            return {
                ok: false,
                error: error.message || 'Internal server error'
            };
        }
    });
}