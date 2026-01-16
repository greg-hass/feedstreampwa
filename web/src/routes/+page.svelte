<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import {
    RefreshCw,
    Plus,
    FolderPlus,
    LayoutGrid,
    Shuffle,
  } from "lucide-svelte";

  // Components
  import MobileHeader from "$lib/components/MobileHeader.svelte";
  import FeedGrid from "$lib/components/FeedGrid.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import SkeletonCard from "$lib/components/SkeletonCard.svelte";
  import FilterChips from "$lib/components/FilterChips.svelte";
  import PullToRefresh from "$lib/components/PullToRefresh.svelte";
  import OnboardingFlow from "$lib/components/OnboardingFlow.svelte";
  import BulkActionsBar from "$lib/components/BulkActionsBar.svelte";

  // Stores
  import {
    isAddFeedModalOpen,
    isCreateFolderModalOpen,
    viewMode,
    activeSmartFolder,
    activeFolderId,
    selectedFeedUrl,
    viewDensity,
  } from "$lib/stores/ui";
  import {
    items,
    itemsLoading,
    itemsError,
    loadItems,
    currentOffset,
    itemsTotal,
    toggleRead,
    toggleStar,
    searchQuery,
    setSearchQuery,
    timeFilter,
    setTimeFilter,
    hasMore,
  } from "$lib/stores/items";
  import {
    refreshAll as refreshAllFeeds,
    refreshState,
    refreshStream,
  } from "$lib/stores/feeds";
  import { settings } from "$lib/stores/settings";
  import { loadFolders, folders } from "$lib/stores/folders";
  import { openReader } from "$lib/stores/reader";
  import { playMedia } from "$lib/stores/media";
  import { toast } from "$lib/stores/toast";
  import {
    shortcuts,
    registerShortcuts,
    handleKeyboardEvent,
    showShortcutsHelp,
    type KeyboardShortcut,
  } from "$lib/stores/keyboard";
  import { diversitySettings } from "$lib/stores/diversity";
  import KeyboardShortcutsHelp from "$lib/components/KeyboardShortcutsHelp.svelte";
  import ReadingStatsModal from "$lib/components/ReadingStatsModal.svelte";
  import * as itemsApi from "$lib/api/items";

  // State for modals
  let showStats = false;

  // Register shortcuts
  onMount(() => {
    registerShortcuts([
      {
        key: "?",
        description: "Show keyboard shortcuts",
        action: () => showShortcutsHelp.update((v) => !v),
        shift: true,
      },
      {
        key: "/",
        description: "Focus search",
        action: () => {
          const searchInput = document.querySelector(
            'input[type="search"]'
          ) as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            // Prevent the '/' from being typed
            setTimeout(() => (searchInput.value = ""), 0);
          }
        },
      },
      {
        key: "r",
        description: "Refresh feeds",
        action: () => refreshAllFeeds(),
      },
      {
        key: "g",
        description: "Show reading stats",
        action: () => (showStats = !showStats),
        shift: true,
      },
      {
        key: "Escape",
        description: "Close modals / Clear selection",
        action: () => {
          // Logic to close top-most thing
          if (showStats) showStats = false;
          else if ($showShortcutsHelp) showShortcutsHelp.set(false);
          // Selection clearing is handled in store logic or local
        },
      },
    ]);
  });

  function handleKeydown(e: KeyboardEvent) {
    handleKeyboardEvent(e, $shortcuts);
  }

  // Local state
  let isMobile = false;
  let sentinel: HTMLElement;
  let wasRefreshing = false;
  let showOnboarding = false;
  let articlesList: HTMLDivElement;

  const LIVE_POLL_INTERVAL_MS = 1500;
  const LIVE_POLL_LIMIT = 30;
  const LIVE_INSERT_RESET_MS = 2000;
  const LIVE_PRESERVE_SCROLL_THRESHOLD = 120;

  let liveRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  let liveRefreshActive = false;
  let liveRefreshInFlight = false;
  let liveInsertResetTimer: ReturnType<typeof setTimeout> | null = null;
  let liveInsertIds = new Set<string>();
  let previousItemIds = new Set<string>();
  let hasLoadedOnce = false;
  let mobileFiltersHeight = 0;
  let refreshSnapshotIds: Set<string> | null = null;
  let awaitingRefreshResults = false;
  let refreshItemsLoadingSeen = false;
  let newArticlesCount = 0;
  let showNewArticlesBanner = false;
  let showTimeFilter = true;

  const LAST_SYNC_KEY = "last_global_sync";
  let syncIntervalMs: number | null = null;
  let lastSyncMs: number | null = null;
  let refreshCountdown = "Off";
  let refreshCountdownTitle = "Auto refresh is off";
  let countdownTimer: ReturnType<typeof setInterval> | null = null;

  // Watch for refresh completion to reload items
  $: {
    if ($refreshState.isRefreshing && !wasRefreshing) {
      refreshSnapshotIds = new Set($items.map((item) => item.id));
      awaitingRefreshResults = false;
      refreshItemsLoadingSeen = false;
      showNewArticlesBanner = false;
      newArticlesCount = 0;
    }
    if (wasRefreshing && !$refreshState.isRefreshing) {
      awaitingRefreshResults = true;
      refreshItemsLoadingSeen = false;
      loadItems({ ...getLoadParams(), refresh: true });
    }
    wasRefreshing = $refreshState.isRefreshing;
  }

  $: {
    if ($refreshState.isRefreshing) {
      startLiveRefresh();
    } else {
      stopLiveRefresh();
    }
  }

  $: {
    syncIntervalMs = parseIntervalMs($settings?.sync_interval);
    const lastSyncRaw = $settings?.[LAST_SYNC_KEY];
    const parsedLastSync = lastSyncRaw ? parseInt(lastSyncRaw, 10) : NaN;
    if (Number.isFinite(parsedLastSync)) {
      lastSyncMs = parsedLastSync;
    } else {
      lastSyncMs = syncIntervalMs ? Date.now() : null;
    }
    updateRefreshCountdown();
  }

  $: $refreshState.isRefreshing, updateRefreshCountdown();

  $: if (awaitingRefreshResults) {
    if ($itemsLoading) {
      refreshItemsLoadingSeen = true;
    }
    if (!$itemsLoading && refreshItemsLoadingSeen && refreshSnapshotIds) {
      const newCount = $items.filter(
        (item) => !refreshSnapshotIds?.has(item.id)
      ).length;
      if (newCount > 0) {
        newArticlesCount = newCount;
        showNewArticlesBanner = true;
      }
      refreshSnapshotIds = null;
      awaitingRefreshResults = false;
      refreshItemsLoadingSeen = false;
    }
  }

  $: if ($items) {
    if (!hasLoadedOnce) {
      previousItemIds = new Set($items.map((item) => item.id));
      hasLoadedOnce = true;
    } else {
      const newIds = $items
        .filter((item) => !previousItemIds.has(item.id))
        .map((item) => item.id);
      queueLiveInsertIds(newIds);
      previousItemIds = new Set($items.map((item) => item.id));
    }
  }

  $: showTimeFilter = $viewMode !== "all";

  $: if ($viewMode === "all" && $timeFilter !== "all") {
    setTimeFilter("all");
  }

  $: if (typeof document !== "undefined") {
    document.documentElement.style.setProperty(
      "--mobile-filters-height",
      `${showTimeFilter ? mobileFiltersHeight : 0}px`
    );
  }

  // Derived
  $: pageTitle = (() => {
    if ($viewMode === "smart" && $activeSmartFolder) {
      const folderNames: Record<string, string> = {
        rss: "RSS Feeds",
        youtube: "YouTube",
        reddit: "Reddit",
        podcast: "Podcasts",
      };
      return folderNames[$activeSmartFolder] || "Smart Folder";
    } else if ($viewMode === "folder" && $activeFolderId) {
      const folder = $folders.find((f) => f.id === $activeFolderId);
      return folder?.name || "Folder";
    } else if ($viewMode === "feed" && $selectedFeedUrl) {
      return "Feed";
    } else if ($viewMode === "unread") {
      return "Unread";
    } else if ($viewMode === "bookmarks") {
      return "Bookmarks";
    }
    return "All Articles";
  })();

  function getLoadParams() {
    const params: any = {};
    if ($viewMode === "feed" && $selectedFeedUrl)
      params.feedUrl = $selectedFeedUrl;
    if ($viewMode === "smart" && $activeSmartFolder)
      params.smartFolder = $activeSmartFolder;
    if ($viewMode === "folder" && $activeFolderId)
      params.folderId = $activeFolderId;
    if ($viewMode === "unread") params.unreadOnly = true;
    if ($viewMode === "bookmarks") params.starredOnly = true;
    if ($viewMode !== "all") params.timeFilter = $timeFilter;
    return params;
  }

  function loadMore() {
    loadItems({ ...getLoadParams(), refresh: false });
  }

  function parseIntervalMs(interval: string | undefined): number | null {
    if (!interval || interval === "off") return null;
    const match = interval.match(/^(\d+)([mhd])$/);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    if (!Number.isFinite(value)) return null;
    const unit = match[2];
    if (unit === "m") return value * 60 * 1000;
    if (unit === "h") return value * 60 * 60 * 1000;
    if (unit === "d") return value * 24 * 60 * 60 * 1000;
    return null;
  }

  function formatCountdown(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function queueLiveInsertIds(ids: string[]) {
    if (ids.length === 0) return;
    liveInsertIds = new Set([...liveInsertIds, ...ids]);
    if (liveInsertResetTimer) clearTimeout(liveInsertResetTimer);
    liveInsertResetTimer = setTimeout(() => {
      liveInsertIds = new Set();
    }, LIVE_INSERT_RESET_MS);
  }


  function updateRefreshCountdown() {
    if ($refreshState.isRefreshing) {
      refreshCountdown = "Refreshing";
      refreshCountdownTitle = "Refreshing feeds";
      return;
    }

    if (!syncIntervalMs) {
      refreshCountdown = "Off";
      refreshCountdownTitle = "Auto refresh is off";
      return;
    }

    const base = lastSyncMs && Number.isFinite(lastSyncMs) ? lastSyncMs : Date.now();
    const now = Date.now();
    const elapsed = Math.max(0, now - base);
    const remainder = elapsed % syncIntervalMs;
    const remaining = remainder === 0 ? 0 : syncIntervalMs - remainder;

    refreshCountdown = formatCountdown(remaining);
    refreshCountdownTitle = `Next auto refresh in ${refreshCountdown}`;
  }

  function dismissNewArticlesBanner() {
    showNewArticlesBanner = false;
    newArticlesCount = 0;
  }

  function viewNewArticles() {
    dismissNewArticlesBanner();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function startLiveRefresh() {
    if (typeof window === "undefined" || liveRefreshActive) return;
    liveRefreshActive = true;
    pollLiveItems();
  }

  function stopLiveRefresh() {
    if (!liveRefreshActive) return;
    liveRefreshActive = false;
    liveRefreshInFlight = false;
    if (liveRefreshTimer) {
      clearTimeout(liveRefreshTimer);
      liveRefreshTimer = null;
    }
    if (liveInsertResetTimer) {
      clearTimeout(liveInsertResetTimer);
      liveInsertResetTimer = null;
    }
    liveInsertIds = new Set();
  }

  async function pollLiveItems() {
    if (!liveRefreshActive || liveRefreshInFlight) return;
    liveRefreshInFlight = true;

    if (liveRefreshTimer) {
      clearTimeout(liveRefreshTimer);
      liveRefreshTimer = null;
    }

    try {
      if (!$refreshState.isRefreshing) return;
      if ($itemsLoading) return;
      if ($searchQuery.trim()) return;

      const params = {
        ...getLoadParams(),
        limit: LIVE_POLL_LIMIT,
        offset: 0,
      };

      // Keep the viewport stable if the user isn't near the top.
      const prevScrollHeight = articlesList?.scrollHeight || 0;
      const shouldPreserveScroll =
        typeof window !== "undefined" &&
        window.scrollY > LIVE_PRESERVE_SCROLL_THRESHOLD;

      const data = await itemsApi.fetchItems(params);
      const existingIds = new Set($items.map((item) => item.id));
      const newItems = data.items.filter((item) => !existingIds.has(item.id));

      if (newItems.length > 0) {
        items.update((current) => [...newItems, ...current]);
        itemsTotal.set(data.total);
        currentOffset.update((n) => n + newItems.length);
        queueLiveInsertIds(newItems.map((item) => item.id));

        await tick();
        const nextScrollHeight = articlesList?.scrollHeight || 0;
        const delta = nextScrollHeight - prevScrollHeight;
        if (shouldPreserveScroll && delta > 0) {
          window.scrollBy(0, delta);
        }
      }
    } catch (err) {
      console.warn("Live refresh poll failed:", err);
    } finally {
      liveRefreshInFlight = false;
      if (liveRefreshActive && $refreshState.isRefreshing) {
        liveRefreshTimer = setTimeout(pollLiveItems, LIVE_POLL_INTERVAL_MS);
      }
    }
  }

  async function refreshAll() {
    try {
      await refreshAllFeeds();
    } catch (err) {
      console.error("Failed to refresh feeds:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to refresh feeds"
      );
    }
  }

  function cycleDensity() {
    const densities: ("compact" | "comfortable" | "spacious")[] = [
      "compact",
      "comfortable",
      "spacious",
    ];
    const currentIndex = densities.indexOf($viewDensity);
    const nextIndex = (currentIndex + 1) % densities.length;
    viewDensity.set(densities[nextIndex]);
  }

  onMount(() => {
    // Initial load
    loadItems();
    updateRefreshCountdown();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateRefreshCountdown, 1000);

    const checkMobile = () => {
      isMobile = window.innerWidth <= 768;
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    // Infinite Scroll Observer
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && $hasMore && !$itemsLoading) {
          loadMore();
        }
      },
      { rootMargin: "400px" }
    );

    if (sentinel) observer.observe(sentinel);

    return () => {
      window.removeEventListener("resize", checkMobile);
      observer.disconnect();
    };
  });

  onDestroy(() => {
    stopLiveRefresh();
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  });

  // Reactive reload
  $: if (
    $viewMode ||
    $activeSmartFolder ||
    $activeFolderId ||
    $selectedFeedUrl ||
    $timeFilter
  ) {
    dismissNewArticlesBanner();
    loadItems(getLoadParams());
  }
</script>

<svelte:head>
  <title>FeedStream - Private feed reader</title>
</svelte:head>

<!-- Pull to Refresh (Mobile Only) -->
{#if isMobile}
  <PullToRefresh on:refresh={refreshAll} />
{/if}

<!-- Sticky Header Container (Desktop Search + Filter) -->
{#if !isMobile}
  <div class="sticky-header">
    <!-- Page Header -->
    <div class="page-header">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-white">{pageTitle}</h1>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2">
            <button
              class="p-2.5 rounded-xl bg-zinc-700 hover:bg-zinc-600 transition-all shadow-lg shadow-black/20 text-white"
              on:click={refreshAll}
              class:spinning={$refreshState.isRefreshing}
              title="Refresh"
            >
              <RefreshCw size={20} />
            </button>
            <span
              class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/60"
              title={$refreshStream.status === "connected"
                ? "Live updates connected"
                : "Reconnecting to live updates"}
            >
              <span
                class={`h-2 w-2 rounded-full ${$refreshStream.status === "connected"
                  ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.45)]"
                  : "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.45)] animate-pulse"}`}
              ></span>
              {$refreshStream.status === "connected" ? "Live" : "Reconnecting"}
            </span>
            <span
              class="text-xs font-semibold text-white/60"
              title={refreshCountdownTitle}
            >
              {refreshCountdown}
            </span>
          </div>
          <button
            class="p-2.5 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 transition-all shadow-lg shadow-slate-500/20 text-white relative group"
            on:click={cycleDensity}
            title="View Density: {$viewDensity}"
          >
            <LayoutGrid size={20} />
            <span
              class="absolute -bottom-1 -right-1 text-[9px] font-bold bg-white text-slate-900 rounded-full w-4 h-4 flex items-center justify-center"
            >
              {$viewDensity === "compact"
                ? "C"
                : $viewDensity === "spacious"
                  ? "S"
                  : "M"}
            </span>
          </button>
          <button
            class="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 transition-all shadow-lg shadow-cyan-500/20 text-white {$diversitySettings.enabled
              ? 'ring-2 ring-white/50'
              : ''}"
            on:click={() => diversitySettings.toggle()}
            title="Source Diversity: {$diversitySettings.enabled
              ? 'On'
              : 'Off'} - Highlight diverse sources"
          >
            <Shuffle size={20} />
          </button>
          <button
            class="p-2.5 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] transition-all shadow-lg shadow-black/20 text-zinc-900"
            on:click={() => isCreateFolderModalOpen.set(true)}
            title="Add Folder"
          >
            <FolderPlus size={20} />
          </button>
          <button
            class="p-2.5 rounded-xl bg-accent hover:bg-accent hover:shadow-xl hover:shadow-accent/30 transition-all shadow-lg shadow-accent/20 text-white"
            on:click={() => isAddFeedModalOpen.set(true)}
            title="Add Feed"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </div>

    <!-- Search Bar -->
    <div class="search-bar-full">
      <SearchBar
        bind:value={$searchQuery}
        placeholder="Search articles..."
        onInput={() => loadItems()}
        onClear={() => {
          setSearchQuery("");
          loadItems();
        }}
      />
    </div>

    <!-- Filter Chips -->
    {#if showTimeFilter}
      <FilterChips
        timeFilter={$timeFilter}
        on:change={(e) => setTimeFilter(e.detail)}
      />
    {/if}
  </div>
{:else}
  <!-- Mobile Header (Already Sticky) -->
  <MobileHeader
    bind:searchQuery={$searchQuery}
    onSearchInput={() => loadItems()}
    onSearchClear={() => {
      setSearchQuery("");
      loadItems();
    }}
    onRefresh={refreshAll}
    isRefreshing={$refreshState.isRefreshing}
    refreshCountdown={refreshCountdown}
    refreshCountdownTitle={refreshCountdownTitle}
    refreshStreamStatus={$refreshStream.status}
  />

  <!-- Sticky Filter Chips for Mobile -->
  {#if showTimeFilter}
    <div class="mobile-sticky-filters" bind:clientHeight={mobileFiltersHeight}>
      <FilterChips
        timeFilter={$timeFilter}
        on:change={(e) => setTimeFilter(e.detail)}
      />
    </div>
  {/if}
{/if}

<!-- Articles List -->
<div class="articles-list" bind:this={articlesList}>
  {#if $itemsLoading && $items.length === 0}
    <div class="flex flex-col gap-0 w-full">
      {#each Array(5) as _ (Math.random())}
        <SkeletonCard density={$viewDensity} />
      {/each}
    </div>
  {:else if $itemsError}
    <div class="empty-state error">{$itemsError}</div>
  {:else if $items.length === 0}
    <div class="empty-state">
      No articles found. Add some feeds to get started!
    </div>
  {:else}
    {#if showNewArticlesBanner}
      <div
        class="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3"
        role="status"
        aria-live="polite"
      >
        <span class="text-sm font-semibold text-white">
          {newArticlesCount} new article{newArticlesCount === 1 ? "" : "s"} added
        </span>
        <div class="flex items-center gap-2">
          <button
            class="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white shadow-lg shadow-accent/30 transition-all hover:shadow-accent/40"
            on:click={viewNewArticles}
          >
            View
          </button>
          <button
            class="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/70 transition-colors hover:text-white"
            on:click={dismissNewArticlesBanner}
          >
            Dismiss
          </button>
        </div>
      </div>
    {/if}
    <FeedGrid
      items={$items}
      {liveInsertIds}
      density={$viewDensity}
      on:open={(e) => openReader(e.detail.item)}
      on:toggleStar={(e) => toggleStar(e.detail.item)}
      on:toggleRead={(e) => toggleRead(e.detail.item)}
      on:play={(e) => {
        const item = e.detail.item;
        if (
          item.source === "youtube" ||
          (item.url &&
            (item.url.includes("youtube.com") || item.url.includes("youtu.be")))
        ) {
          openReader(item);
        } else {
          playMedia(item);
        }
      }}
    />

    <!-- Loading spinner at bottom for infinite scroll -->
    {#if $itemsLoading}
      <div class="py-4 flex justify-center">
        <div
          class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"
        ></div>
      </div>
    {/if}

    <div bind:this={sentinel} class="h-4 w-full"></div>
  {/if}
</div>

<OnboardingFlow />
<BulkActionsBar />
<KeyboardShortcutsHelp shortcuts={$shortcuts} />
<ReadingStatsModal bind:isOpen={showStats} />

<svelte:window on:keydown={handleKeydown} />

<style>
  /* Prevent horizontal scroll */
  :global(body) {
    overflow-x: hidden;
    max-width: 100vw;
  }

  /* Fixed Header Container (Desktop) */
  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background: theme("colors.background");
    padding: 0 0 12px 0; /* Remove top padding, let parent handle alignment */
    border-bottom: 1px solid theme("colors.stroke"); /* Use theme color */
  }

  /* Mobile Fixed Filter Chips */
  .mobile-sticky-filters {
    position: fixed;
    top: var(--mobile-header-height, 52px);
    left: 0;
    right: 0;
    z-index: 25;
    background: theme("colors.background");
    padding: 12px 0;
    border-bottom: 1px solid theme("colors.stroke"); /* Use theme color */
  }

  /* Page Header */
  .page-header {
    margin-bottom: 12px;
  }

  .page-header h1 {
    font-size: 28px;
    font-weight: 700;
  }

  .search-bar-full {
    margin-bottom: 12px;
  }

  .articles-list {
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    padding: 80px 20px;
    text-align: center;
    color: var(--muted2);
    font-size: 15px;
  }

  .empty-state.error {
    color: #ff5252;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  @media (min-width: 769px) {
    .articles-list {
      padding-top: 20px; /* Reduced from 132px since header is sticky */
    }
  }

  @media (max-width: 768px) {
    .page-header,
    .search-bar-full {
      margin-bottom: 12px;
    }

    .articles-list {
      padding-top: calc(
        var(--mobile-header-height, 52px) +
          var(--mobile-filters-height, 60px)
      );
    }
  }
</style>
