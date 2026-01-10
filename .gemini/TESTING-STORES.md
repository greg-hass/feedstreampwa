# Testing the New Stores

## Quick Test Checklist

Before migrating the main app, let's verify the stores work:

### ✅ Test 1: TypeScript Compilation

Run this to check for type errors:
```bash
cd web
npm run check
```

**Expected:** No errors (or only existing errors from +page.svelte)

### ✅ Test 2: Build Test

```bash
cd web
npm run build
```

**Expected:** Successful build

### ✅ Test 3: Import Test

Create a simple test component to verify imports work:

**File:** `web/src/routes/test-stores/+page.svelte`

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import {
    feeds,
    feedsLoading,
    loadFeeds,
    totalUnread,
    items,
    loadItems,
    bookmarkedCount,
  } from '$lib/stores';

  onMount(async () => {
    await Promise.all([loadFeeds(), loadItems()]);
  });
</script>

<div style="padding: 20px; font-family: sans-serif;">
  <h1>Store Test Page</h1>

  <section>
    <h2>Feeds Store</h2>
    {#if $feedsLoading}
      <p>Loading feeds...</p>
    {:else}
      <p>✅ Feeds loaded: {$feeds.length}</p>
      <p>✅ Total unread: {$totalUnread}</p>
    {/if}
  </section>

  <section>
    <h2>Items Store</h2>
    <p>✅ Articles loaded: {$items.length}</p>
    <p>✅ Bookmarked: {$bookmarkedCount}</p>
  </section>

  <section>
    <h2>Feed List</h2>
    <ul>
      {#each $feeds.slice(0, 5) as feed}
        <li>{feed.title} ({feed.type}) - {feed.unreadCount || 0} unread</li>
      {/each}
    </ul>
  </section>
</div>
```

Then visit: `http://localhost:5173/test-stores`

**Expected:** 
- ✅ Feeds count displayed
- ✅ Unread count displayed
- ✅ Articles count displayed
- ✅ Bookmark count displayed
- ✅ Feed list shown

### ✅ Test 4: API Calls Work

In browser console:
```javascript
// Should see network requests to:
// - /api/feeds
// - /api/items
```

### ✅ Test 5: Reactive Updates

Modify the test page to test toggling:

```svelte
<script lang="ts">
  import { items, toggleStar } from '$lib/stores';
  
  async function testToggle() {
    if ($items.length > 0) {
      await toggleStar($items[0]);
      console.log('Toggled star on first item');
    }
  }
</script>

<button on:click={testToggle}>Test Toggle Star</button>
```

**Expected:** 
- ✅ Button click updates UI instantly (optimistic update)
- ✅ Network request to `/api/items/{id}/star`
- ✅ No errors in console

## Common Issues & Fixes

### Issue 1: "Cannot find module '$lib/stores'"

**Fix:** Make sure `web/tsconfig.json` has:
```json
{
  "compilerOptions": {
    "paths": {
      "$lib": ["./src/lib"],
      "$lib/*": ["./src/lib/*"]
    }
  }
}
```

### Issue 2: Type errors in stores

**Fix:** Run:
```bash
cd web
npm install --save-dev @sveltejs/kit
```

### Issue 3: Build fails

**Fix:** Check that all imports use correct paths:
- `import type { Feed } from '$lib/types';` ✅
- `import type { Feed } from './types';` ❌

## Manual Testing Steps

1. **Rebuild the app:**
   ```bash
   docker compose build web && docker compose up -d web
   ```

2. **Check logs:**
   ```bash
   docker compose logs -f web
   ```
   Look for: "ready in XXXms" (no errors)

3. **Open the app:**
   - Visit `http://localhost:5173`
   - Should work exactly as before (stores are drop-in replacements)

4. **Test functionality:**
   - ✅ Feeds load
   - ✅ Articles load
   - ✅ Star/unstar works
   - ✅ Mark as read works
   - ✅ Folders work
   - ✅ Search works

## Success Criteria

✅ App builds without errors
✅ App runs without errors
✅ All existing functionality still works
✅ No console errors
✅ Network requests look the same

## If Everything Works:

The stores are **production-ready**! You can now:
1. Start migrating `+page.svelte` to use them
2. Extract components
3. Delete old code

## If Something Breaks:

1. Check browser console for errors
2. Check `docker compose logs web` for server errors
3. Verify TypeScript compilation: `npm run check`
4. Compare API calls in Network tab (should be identical)

---

**Ready to test?** Run:
```bash
cd /Volumes/USB\ STORAGE/Projects/FeedStream-PWA
docker compose build web && docker compose up -d web
```

Then check if the app still works!
