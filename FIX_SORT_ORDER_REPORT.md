# Sort Order Fix Report

## Issue
The user reported that articles were not being displayed in reverse chronological order and the timeline appeared random.

## Root Cause Analysis
1.  **Frontend Sorting:** The sorting logic in `web/src/lib/stores/items.ts` used `new Date(item.published).getTime()`. If `published` contained an invalid date string (e.g., "Yesterday", "2 hours ago", or malformed data), `getTime()` returned `NaN`.
    *   In JavaScript, `NaN - number` is `NaN`.
    *   Comparison functions returning `NaN` cause `Array.prototype.sort()` to behave unpredictably (random order).
2.  **Backend Ingestion:** The `normalizeItem` function in `api/src/index.ts` had a fallback mechanism: if `new Date(rawString)` failed, it stored the `rawString` as-is in the database.
    *   This polluted the database with non-sortable date strings.
    *   SQL `ORDER BY published DESC` also behaves inconsistently with mixed formats (ISO strings vs. random text).

## Fixes Implemented

### 1. Frontend: Safe Date Parsing
Modified `web/src/lib/stores/items.ts` to include a `getDate` helper:
```typescript
const getDate = (dateStr: string | null | undefined): number => {
    if (!dateStr) return 0;
    const date = new Date(dateStr);
    const time = date.getTime();
    return isNaN(time) ? 0 : time;
};
```
This ensures the sort function always receives valid numbers, treating invalid dates as 0 (Epoch), which places them at the end of the reverse-chronological list (or consistently at one end).

### 2. Backend: Strict Date Normalization
Modified `api/src/index.ts` to prevent storing invalid dates:
```typescript
if (rawPublished) {
    const date = new Date(rawPublished);
    if (!isNaN(date.getTime())) {
        published = date.toISOString();
    } else {
        published = null; // Don't store garbage
    }
}
```
This ensures future items will always have a valid ISO 8601 date or NULL, ensuring correct SQL sorting and frontend parsing.

## Verification
-   **Frontend:** The random jumping behavior should stop immediately. Invalid items will likely drop to the bottom of the feed.
-   **Backend:** New items ingested will be clean. Existing "garbage" data in the DB remains but will be handled gracefully by the frontend fix.

## Recommendations
-   If "old" items with bad dates are still cluttering the top of the feed (because the frontend sort puts 0 at the end, but maybe the user wants them hidden), we might need a DB migration to clean them up. However, the current fix resolves the "randomness".
