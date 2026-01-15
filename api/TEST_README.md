# FeedStream API - Testing Guide

## Overview

This project uses [Vitest](https://vitest.dev/) for unit and integration testing. Vitest is a fast, modern testing framework that's compatible with Jest APIs but built specifically for Vite projects.

## Quick Start

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI (browser-based interface)
npm run test:ui
```

## Test Structure

```
api/src/
├── test/
│   └── setup.ts              # Test utilities and setup
├── services/
│   └── feed-service.test.ts  # Unit tests for feed service
├── routes/
│   └── feeds.test.ts         # Integration tests for feeds routes
└── types/
    └── schemas.test.ts       # Validation schema tests
```

## Test Types

### 1. Unit Tests

Test individual functions and modules in isolation.

**Example:** `src/services/feed-service.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Feed Service', () => {
    it('should validate feed URL', () => {
        expect(isValidUrl('https://example.com/feed')).toBe(true);
    });
});
```

### 2. Integration Tests

Test API routes and database interactions.

**Example:** `src/routes/feeds.test.ts`

```typescript
import { beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';

describe('Feeds API', () => {
    let app;

    beforeAll(async () => {
        app = Fastify();
        await app.register(feedRoutes);
        await app.ready();
    });

    it('GET /api/feeds should return feeds', async () => {
        const response = await app.inject({
            method: 'GET',
            url: '/api/feeds'
        });
        expect(response.statusCode).toBe(200);
    });
});
```

### 3. Schema Validation Tests

Test Zod validation schemas.

**Example:** `src/types/schemas.test.ts`

```typescript
import { AddFeedSchema } from './schemas';

it('should validate feed data', () => {
    const result = AddFeedSchema.safeParse({
        url: 'https://example.com/feed.xml'
    });
    expect(result.success).toBe(true);
});
```

## Test Utilities

### createTestDb()

Creates an in-memory SQLite database for testing.

```typescript
import { createTestDb } from './test/setup';

const db = createTestDb();
// Database is initialized with schema and migrations
```

### seedTestDb(db)

Populates test database with sample data.

```typescript
import { seedTestDb } from './test/setup';

seedTestDb(db);
// Now has sample feeds, items, and folders
```

### cleanupTestDb(db)

Closes and cleans up test database.

```typescript
import { cleanupTestDb } from './test/setup';

afterEach(() => {
    cleanupTestDb(db);
});
```

## Writing New Tests

### 1. Create Test File

Name your test files with `.test.ts` or `.spec.ts` suffix:

```bash
touch src/services/my-service.test.ts
```

### 2. Import Testing Utilities

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, cleanupTestDb } from './test/setup';
```

### 3. Structure Your Tests

```typescript
describe('My Feature', () => {
    let db;

    beforeEach(() => {
        db = createTestDb();
    });

    afterEach(() => {
        cleanupTestDb(db);
    });

    describe('Specific Functionality', () => {
        it('should do something', () => {
            // Arrange
            const input = 'test';

            // Act
            const result = myFunction(input);

            // Assert
            expect(result).toBe('expected');
        });
    });
});
```

## Coverage

View coverage report after running:

```bash
npm run test:coverage
```

Coverage report will be generated in:
- Terminal (text summary)
- `coverage/` directory (HTML report)

Open `coverage/index.html` in browser for detailed coverage.

## Best Practices

### ✅ Do

- Write tests for critical business logic
- Test edge cases and error conditions
- Use descriptive test names
- Keep tests focused and isolated
- Mock external dependencies (API calls, file system)
- Clean up resources in afterEach/afterAll

### ❌ Don't

- Test implementation details
- Write tests that depend on external services
- Share state between tests
- Make tests depend on execution order
- Leave tests commented out

## Examples

### Testing Database Operations

```typescript
it('should create feed with transaction', () => {
    db.transaction(() => {
        db.prepare('INSERT INTO feeds ...').run(...);
        db.prepare('INSERT INTO items ...').run(...);
    })();

    const feed = db.prepare('SELECT * FROM feeds WHERE url = ?').get(url);
    expect(feed).toBeDefined();
});
```

### Testing API Endpoints

```typescript
it('should return 400 for invalid input', async () => {
    const response = await app.inject({
        method: 'POST',
        url: '/api/feeds',
        payload: { url: 'invalid' }
    });

    expect(response.statusCode).toBe(400);
});
```

### Testing Validation Schemas

```typescript
it('should reject empty title', () => {
    const result = RenameFeedSchema.safeParse({
        url: 'https://example.com/feed',
        title: ''
    });

    expect(result.success).toBe(false);
    if (!result.success) {
        expect(result.error.issues[0].message).toContain('title');
    }
});
```

## Continuous Integration

Tests should run automatically in CI/CD pipeline:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    cd api
    npm install
    npm test
```

## Troubleshooting

### Tests Hanging

- Check for missing `await` in async tests
- Ensure database connections are closed
- Verify no infinite loops in code

### Database Errors

- Ensure migrations are applied: `db = createTestDb()`
- Check foreign key constraints
- Verify data cleanup between tests

### Import Errors

- Ensure `.js` extensions in imports (ESM)
- Check `package.json` has `"type": "module"`
- Verify paths in `tsconfig.json`

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Fastify Testing](https://www.fastify.io/docs/latest/Guides/Testing/)
- [Better-SQLite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
