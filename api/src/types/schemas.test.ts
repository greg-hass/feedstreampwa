/**
 * Unit tests for Zod validation schemas
 */
import { describe, it, expect } from 'vitest';
import {
    AddFeedSchema,
    RenameFeedSchema,
    RefreshFeedsSchema,
    RefreshStatusQuerySchema,
    FeedKindSchema
} from './schemas.js';

describe('Validation Schemas', () => {
    describe('FeedKindSchema', () => {
        it('should accept valid feed kinds', () => {
            const validKinds = ['generic', 'youtube', 'reddit', 'podcast'];

            validKinds.forEach(kind => {
                const result = FeedKindSchema.safeParse(kind);
                expect(result.success).toBe(true);
            });
        });

        it('should reject invalid feed kinds', () => {
            const invalidKinds = ['twitter', 'facebook', 'invalid', ''];

            invalidKinds.forEach(kind => {
                const result = FeedKindSchema.safeParse(kind);
                expect(result.success).toBe(false);
            });
        });
    });

    describe('AddFeedSchema', () => {
        it('should accept valid feed data', () => {
            const validData = {
                url: 'https://example.com/feed.xml',
                refresh: true,
                folderIds: ['folder-1', 'folder-2'],
                title: 'My Feed'
            };

            const result = AddFeedSchema.safeParse(validData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.url).toBe(validData.url);
                expect(result.data.refresh).toBe(true);
                expect(result.data.folderIds).toEqual(validData.folderIds);
            }
        });

        it('should use default values', () => {
            const minimalData = {
                url: 'https://example.com/feed.xml'
            };

            const result = AddFeedSchema.safeParse(minimalData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.refresh).toBe(false); // default
                expect(result.data.folderIds).toEqual([]); // default
            }
        });

        it('should reject invalid URLs', () => {
            const invalidData = {
                url: 'not-a-url'
            };

            const result = AddFeedSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject non-array folderIds', () => {
            const invalidData = {
                url: 'https://example.com/feed.xml',
                folderIds: 'not-an-array'
            };

            const result = AddFeedSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('RenameFeedSchema', () => {
        it('should accept valid rename data', () => {
            const validData = {
                url: 'https://example.com/feed.xml',
                title: 'New Title'
            };

            const result = RenameFeedSchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject empty title', () => {
            const invalidData = {
                url: 'https://example.com/feed.xml',
                title: ''
            };

            const result = RenameFeedSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject missing fields', () => {
            const missingUrl = { title: 'Title' };
            const missingTitle = { url: 'https://example.com/feed.xml' };

            expect(RenameFeedSchema.safeParse(missingUrl).success).toBe(false);
            expect(RenameFeedSchema.safeParse(missingTitle).success).toBe(false);
        });
    });

    describe('RefreshFeedsSchema', () => {
        it('should accept empty body (refresh all)', () => {
            const result = RefreshFeedsSchema.safeParse({});
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.urls).toBeUndefined();
            }
        });

        it('should accept array of URLs', () => {
            const validData = {
                urls: [
                    'https://example.com/feed1.xml',
                    'https://example.com/feed2.xml'
                ]
            };

            const result = RefreshFeedsSchema.safeParse(validData);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.urls).toHaveLength(2);
            }
        });

        it('should reject invalid URLs in array', () => {
            const invalidData = {
                urls: ['https://example.com/feed.xml', 'not-a-url']
            };

            const result = RefreshFeedsSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject non-array urls', () => {
            const invalidData = {
                urls: 'https://example.com/feed.xml'
            };

            const result = RefreshFeedsSchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });
    });

    describe('RefreshStatusQuerySchema', () => {
        it('should accept valid jobId', () => {
            const validData = {
                jobId: 'job_123456_abc'
            };

            const result = RefreshStatusQuerySchema.safeParse(validData);
            expect(result.success).toBe(true);
        });

        it('should reject empty jobId', () => {
            const invalidData = {
                jobId: ''
            };

            const result = RefreshStatusQuerySchema.safeParse(invalidData);
            expect(result.success).toBe(false);
        });

        it('should reject missing jobId', () => {
            const result = RefreshStatusQuerySchema.safeParse({});
            expect(result.success).toBe(false);
        });
    });
});
