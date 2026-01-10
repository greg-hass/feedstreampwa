# Refactoring Plan: Breaking Down the Monolith

## Current State: 🚨 CRITICAL ISSUES

**File:** `+page.svelte` - **6,486 lines** (!!!)

### Problems:
1. **Unmaintainable** - Simple CSS changes require Python scripts
2. **No separation of concerns** - Logic, UI, styles all mixed
3. **Poor testability** - Can't unit test individual components
4. **Slow IDE performance** - 6.5K lines kills autocomplete
5. **Merge conflicts** - Any team collaboration would be a nightmare
6. **Code duplication** - Repeated patterns everywhere
7. **Hard to reason about** - Impossible to understand flow

## Recommended Architecture

### SvelteKit Best Practices Structure:

```
web/src/
├── routes/
│   └── +page.svelte (100-200 lines max - composition only)
├── lib/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Topbar.svelte
│   │   │   ├── Sidebar.svelte
│   │   │   ├── MobileTabBar.svelte
│   │   │   └── MobileDrawer.svelte
│   │   ├── articles/
│   │   │   ├── ArticleCard.svelte
│   │   │   ├── ArticleList.svelte
│   │   │   ├── ArticleMeta.svelte
│   │   │   └── FilterChips.svelte
│   │   ├── reader/
│   │   │   ├── ReaderView.svelte
│   │   │   └── YouTubePlayer.svelte
│   │   ├── feeds/
│   │   │   ├── FeedList.svelte
│   │   │   ├── FeedItem.svelte
│   │   │   └── AddFeedModal.svelte
│   │   ├── folders/
│   │   │   ├── FolderList.svelte
│   │   │   ├── FolderItem.svelte
│   │   │   ├── CreateFolderModal.svelte
│   │   │   └── ManageFolderModal.svelte
│   │   ├── modals/
│   │   │   ├── SettingsModal.svelte
│   │   │   └── ConfirmDialog.svelte
│   │   └── ui/
│   │       ├── Button.svelte
│   │       ├── Badge.svelte
│   │       └── FloatingActionButton.svelte
│   ├── stores/
│   │   ├── feeds.ts (feed state + actions)
│   │   ├── items.ts (article state + actions)
│   │   ├── folders.ts (folder state + actions)
│   │   ├── reader.ts (reader state)
│   │   ├── ui.ts (UI state - modals, mobile, etc)
│   │   └── settings.ts (app settings)
│   ├── api/
│   │   ├── feeds.ts
│   │   ├── items.ts
│   │   ├── folders.ts
│   │   └── settings.ts
│   ├── utils/
│   │   ├── date.ts
│   │   ├── youtube.ts
│   │   └── keyboard.ts
│   └── types/
│       └── index.ts (TypeScript interfaces)
└── app.css (global styles only)
```

## Refactoring Strategy

### Phase 1: Extract Stores (State Management) - **HIGH PRIORITY**
Move all state to Svelte stores:

**`lib/stores/feeds.ts`** (~150 lines)
```typescript
import { writable, derived } from 'svelte/store';

export const feeds = writable<Feed[]>([]);
export const feedsLoading = writable(false);
export const feedsError = writable<string | null>(null);

export const rssFeeds = derived(feeds, $feeds => 
  $feeds.filter(f => f.type === 'rss')
);

export async function loadFeeds() { /* ... */ }
export async function addFeed(url: string) { /* ... */ }
export async function deleteFeed(url: string) { /* ... */ }
```

**Benefits:**
- Reactive state across components
- Easy to test
- Clear data flow
- Can be used anywhere

### Phase 2: Extract API Layer - **HIGH PRIORITY**
Centralize all API calls:

**`lib/api/feeds.ts`** (~100 lines)
```typescript
export async function fetchFeeds(): Promise<Feed[]> {
  const response = await fetch('/api/feeds');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data.feeds || [];
}

export async function createFeed(url: string, folders?: string[]) {
  // ...
}
```

**Benefits:**
- Single source of truth for API calls
- Easy to mock for testing
- Consistent error handling
- Type-safe responses

### Phase 3: Extract Components - **MEDIUM PRIORITY**
Break UI into reusable components:

**`lib/components/articles/ArticleCard.svelte`** (~80 lines)
```svelte
<script lang="ts">
  export let article: Article;
  export let onToggleStar: (article: Article) => void;
  export let onToggleRead: (article: Article) => void;
  export let onClick: (article: Article) => void;
</script>

<article class="article-card" class:unread={article.is_read === 0}>
  <!-- Clean, focused component -->
</article>

<style>
  /* Component-scoped styles */
</style>
```

**Benefits:**
- Reusable across views
- Easy to test in isolation
- Clear props interface
- Scoped styles

### Phase 4: Extract Modals - **MEDIUM PRIORITY**
Each modal becomes its own component:

**`lib/components/modals/SettingsModal.svelte`**
**`lib/components/feeds/AddFeedModal.svelte`**
**`lib/components/folders/CreateFolderModal.svelte`**

### Phase 5: Extract Layout Components - **LOW PRIORITY**
**`lib/components/layout/Topbar.svelte`**
**`lib/components/layout/Sidebar.svelte`**
**`lib/components/layout/MobileTabBar.svelte`**

## Migration Path

### Option A: Big Bang (Risky, Fast)
- Refactor everything at once
- High risk of breaking things
- 2-3 days of work
- Hard to test incrementally

### Option B: Strangler Fig Pattern (Safe, Gradual) ✅ RECOMMENDED
1. **Week 1**: Extract stores (no UI changes)
2. **Week 2**: Extract API layer (use in existing +page.svelte)
3. **Week 3**: Extract one component (ArticleCard)
4. **Week 4**: Extract modals one by one
5. **Week 5**: Extract layout components
6. **Week 6**: Final cleanup

**Benefits:**
- Can test each step
- No big-bang deployment
- Rollback is easy
- Team can keep working

## Estimated Impact

### Current State:
- **Lines in +page.svelte**: 6,486
- **Maintainability**: 1/10
- **Testability**: 1/10
- **Performance**: 6/10
- **Developer Experience**: 2/10

### After Refactoring:
- **Lines in +page.svelte**: ~150 (97% reduction!)
- **Total files**: ~40 (vs 1)
- **Average file size**: ~100 lines
- **Maintainability**: 9/10
- **Testability**: 9/10
- **Performance**: 8/10 (better tree-shaking)
- **Developer Experience**: 10/10

## Quick Win: Extract Just Stores (1-2 hours)

Want to start small? Extract just the stores:

```typescript
// lib/stores/index.ts
export { feeds, loadFeeds, addFeed } from './feeds';
export { items, loadItems, toggleStar } from './items';
export { folders, loadFolders } from './folders';
export { ui, openModal, closeModal } from './ui';
```

Then in `+page.svelte`:
```svelte
<script>
  import { feeds, loadFeeds } from '$lib/stores';
  // Now just 200 lines of UI composition!
</script>
```

## Should You Do This?

### YES if:
- ✅ You plan to maintain this long-term
- ✅ You want to add features easily
- ✅ You value developer experience
- ✅ You want to add tests
- ✅ Multiple people work on this

### NO if:
- ❌ This is a throwaway prototype
- ❌ You're abandoning the project soon
- ❌ You never plan to add features

## My Recommendation

**YES, refactor this ASAP.** The current 6.5K line file is:
1. A maintenance nightmare (as we just experienced)
2. A ticking time bomb for bugs
3. Impossible to test properly
4. Slowing down development

Start with **stores** (2 hours), then **API layer** (2 hours), then **components** gradually.

**Want me to start the refactoring?** I can:
1. Create the store structure
2. Extract the API layer
3. Create a few key components
4. Update +page.svelte to use them

This would reduce your main file from 6,486 → ~200 lines in about 4-6 hours of work.
