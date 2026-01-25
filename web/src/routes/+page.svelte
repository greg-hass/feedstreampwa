<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import {
    RefreshCw,
    Plus,
    FolderPlus,
    LayoutGrid,
    Shuffle,
    Rss,
    X,
    Search,
  } from "lucide-svelte";

  import MobileHeader from "$lib/components/MobileHeader.svelte";
  import FeedGrid from "$lib/components/FeedGrid.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import SkeletonCard from "$lib/components/SkeletonCard.svelte";
  import FilterChips from "$lib/components/FilterChips.svelte";
  import PullToRefresh from "$lib/components/PullToRefresh.svelte";
  import OnboardingFlow from "$lib/components/OnboardingFlow.svelte";
  import BulkActionsBar from "$lib/components/BulkActionsBar.svelte";
  import KeyboardShortcutsHelp from "$lib/components/KeyboardShortcutsHelp.svelte";
  import ReadingStatsModal from "$lib/components/ReadingStatsModal.svelte";
  import DiscoverView from "$lib/components/DiscoverView.svelte";
  import SettingsView from "$lib/components/SettingsView.svelte";
  import AddFeedView from "$lib/components/AddFeedView.svelte";
  import ReaderView from "$lib/components/ReaderView.svelte";

  import * as itemsApi from "$lib/api/items";
  import {
    parseIntervalMs,
    formatCountdown,
    getCountdownInterval,
    LIVE_POLL_INTERVAL_MS,
    LIVE_POLL_LIMIT,
    LIVE_INSERT_RESET_MS,
    LIVE_PRESERVE_SCROLL_THRESHOLD,
  } from "$lib/utils/refresh";
  import { getPageTitle } from "$lib/utils/pageTitle";
  import {
    INTERSECTION_MARGIN,
    MOBILE_BREAKPOINT,
  } from "$lib/constants/gestures";
  import type { Item, TimeFilter } from "$lib/types";
  import {
    isAddFeedModalOpen,
    setViewAddFeed,
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
  import { openReader, showReader, currentItem } from "$lib/stores/reader";
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

  let showStats = false;

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
            'input[type="search"]',
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

  let isMobile = false;
  let sentinel: HTMLElement;
  let wasRefreshing = false;
  let showOnboarding = false;
  let articlesList: HTMLDivElement;
  let isSearchOpen = false;
  let desktopSearchInput: HTMLInputElement | null = null;

  async function toggleSearchDesktop() {
    isSearchOpen = !isSearchOpen;
    if (isSearchOpen) {
      await tick();
      desktopSearchInput?.focus();
    }
  }

  function handleDesktopSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      isSearchOpen = false;
      desktopSearchInput?.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setSearchQuery("");
      loadItems();
      isSearchOpen = false;
      desktopSearchInput?.blur();
    }
  }

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
      // Delta updates: Only fetch new items since last fetch
      loadItems({ ...getLoadParams(), delta: true });
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
        (item) => !refreshSnapshotIds?.has(item.id),
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
      `${showTimeFilter ? mobileFiltersHeight : 0}px`,
    );
  }

  $: pageTitle = getPageTitle(
    $viewMode,
    $activeSmartFolder,
    $activeFolderId,
    $selectedFeedUrl,
    $folders,
  );

  function getLoadParams() {
    const params: Record<string, string | boolean | TimeFilter> = {};
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

    const base =
      lastSyncMs && Number.isFinite(lastSyncMs) ? lastSyncMs : Date.now();
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
        err instanceof Error ? err.message : "Failed to refresh feeds",
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

  function setupCountdownTimer(interval: number) {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(updateRefreshCountdown, interval);
  }

  function handleVisibilityChange() {
    const interval = getCountdownInterval(document.hidden);
    if (!document.hidden) {
      updateRefreshCountdown();
      // Refresh items when user returns to the app
      loadItems(getLoadParams());
    }
    setupCountdownTimer(interval);
  }

  function handleWindowFocus() {
    // Refresh items when browser tab regains focus
    loadItems(getLoadParams());
  }

  onMount(() => {
    loadItems();
    updateRefreshCountdown();
    setupCountdownTimer(getCountdownInterval(false));

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    const checkMobile = () => {
      isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && $hasMore && !$itemsLoading) {
          loadMore();
        }
      },
      { rootMargin: INTERSECTION_MARGIN },
    );

    if (sentinel) observer.observe(sentinel);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
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

{#if !isMobile}
  <div class="flex h-screen overflow-hidden bg-background">
    <!-- Left Column: Articles List -->
    <div
      class="w-1/2 flex flex-col border-r border-[#2c2c2e] overflow-hidden"
      class:hidden={$viewMode === "discover" ||
        $viewMode === "settings" ||
        $viewMode === "add-feed"}
    >
      <div
        class="sticky-header px-10 bg-[#121212] border-b border-[#2c2c2e] pt-4"
      >
        <div class="page-header mb-4">
          <div class="flex items-center justify-between">
            <h1 class="text-2xl font-bold text-white tracking-tight">
              {pageTitle}
            </h1>
            <div class="flex items-center gap-2">
              <button
                class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#1c1c1e] transition-all text-[#8e8e93] hover:text-white border border-[#2c2c2e] bg-[#09090b]"
                on:click={toggleSearchDesktop}
                title="Search"
              >
                {#if isSearchOpen}
                  <X size={16} />
                {:else}
                  <Search size={16} />
                {/if}
              </button>
              <button
                class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#1c1c1e] transition-all text-[#8e8e93] hover:text-white border border-[#2c2c2e] bg-[#09090b]"
                on:click={refreshAll}
                class:spinning={$refreshState.isRefreshing}
                title="Refresh"
              >
                <RefreshCw size={16} />
              </button>
              <button
                class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#1c1c1e] transition-all text-[#8e8e93] hover:text-white border border-[#2c2c2e] bg-[#09090b]"
                on:click={cycleDensity}
                title="Density"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        <div
          class="desktop-search overflow-hidden transition-all duration-300 ease-out"
          class:open={isSearchOpen}
        >
          <div class="pb-4 px-0">
            <SearchBar
              bind:inputEl={desktopSearchInput}
              bind:value={$searchQuery}
              placeholder="Search..."
              onInput={() => loadItems()}
              onKeydown={handleDesktopSearchKeydown}
              onClear={() => {
                setSearchQuery("");
                loadItems();
              }}
            />
          </div>
        </div>

        {#if showTimeFilter}
          <div class="pb-4">
            <FilterChips
              timeFilter={$timeFilter}
              on:change={(e) => setTimeFilter(e.detail)}
            />
          </div>
        {/if}
      </div>

      <div
        class="flex-1 overflow-y-auto custom-scrollbar px-6 py-4"
        bind:this={articlesList}
      >
        {#if $itemsLoading && $items.length === 0}
          <div class="flex flex-col gap-0 w-full">
            {#each Array(5) as _ (Math.random())}
              <SkeletonCard density={$viewDensity} />
            {/each}
          </div>
        {:else if $itemsError}
          <div class="empty-state error">{$itemsError}</div>
        {:else if $items.length === 0}
          <div class="empty-state">No articles found.</div>
        {:else}
          {#if showNewArticlesBanner}
            <!-- Banner Simplified for Desktop -->
            <button
              class="w-full mb-4 py-2 bg-accent/10 border border-accent/20 rounded-xl text-accent text-sm font-semibold hover:bg-accent/20 transition-colors"
              on:click={viewNewArticles}
            >
              {newArticlesCount} new articles
            </button>
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
                  (item.url.includes("youtube.com") ||
                    item.url.includes("youtu.be")))
              ) {
                openReader(item);
              } else {
                playMedia(item);
              }
            }}
          />

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
    </div>

    <!-- Right Column: Detail View (Reader / Discover / Settings) -->
    <div
      class="flex flex-col bg-surface/10 overflow-hidden relative
      {$viewMode === 'discover' ||
      $viewMode === 'settings' ||
      $viewMode === 'add-feed'
        ? 'w-full'
        : 'w-1/2'}"
    >
      {#if $viewMode === "discover"}
        <div class="h-full overflow-y-auto custom-scrollbar px-6 py-8">
          <DiscoverView />
        </div>
      {:else if $viewMode === "settings"}
        <div class="h-full overflow-y-auto custom-scrollbar px-6 py-8">
          <SettingsView />
        </div>
      {:else if $viewMode === "add-feed"}
        <div class="h-full overflow-y-auto custom-scrollbar px-6 py-8">
          <AddFeedView />
        </div>
      {:else if $showReader && $currentItem}
        <ReaderView isEmbedded={true} />
      {:else}
        <div
          class="flex-1 flex flex-col items-center justify-center text-muted select-none opacity-20"
        >
          <Rss size={64} class="mb-4" />
          <p class="text-lg font-medium">Select an article to read</p>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <!-- Mobile Layout (Existing) -->
  <PullToRefresh on:refresh={refreshAll} />

  <MobileHeader
    title={pageTitle}
    bind:searchQuery={$searchQuery}
    onSearchInput={() => loadItems()}
    onSearchClear={() => {
      setSearchQuery("");
      loadItems();
    }}
    onRefresh={refreshAll}
    isRefreshing={$refreshState.isRefreshing}
    {refreshCountdownTitle}
    refreshStreamStatus={$refreshStream.status}
  />

  {#if showTimeFilter && $viewMode !== "discover" && $viewMode !== "settings" && $viewMode !== "add-feed"}
    <div class="mobile-sticky-filters" bind:clientHeight={mobileFiltersHeight}>
      <FilterChips
        timeFilter={$timeFilter}
        on:change={(e) => setTimeFilter(e.detail)}
      />
    </div>
  {/if}

  <div class="articles-list p-4 pb-20" bind:this={articlesList}>
    {#if $viewMode === "discover"}
      <DiscoverView />
    {:else if $viewMode === "settings"}
      <SettingsView />
    {:else if $viewMode === "add-feed"}
      <AddFeedView />
    {:else if $itemsLoading && $items.length === 0}
      <div class="flex flex-col gap-0 w-full">
        {#each Array(5) as _ (Math.random())}
          <SkeletonCard density={$viewDensity} />
        {/each}
      </div>
    {:else if $itemsError}
      <div class="empty-state error">{$itemsError}</div>
    {:else if $items.length === 0}
      <div class="empty-state">No articles found.</div>
    {:else}
      {#if showNewArticlesBanner}
        <div
          class="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3"
        >
          <span class="text-sm font-semibold text-white">
            {newArticlesCount} new articles
          </span>
          <button
            class="bg-accent px-3 py-1 rounded-full text-xs font-semibold"
            on:click={viewNewArticles}>View</button
          >
        </div>
      {/if}
      <FeedGrid
        items={$items}
        {liveInsertIds}
        density={$viewDensity}
        on:open={(e) => openReader(e.detail.item)}
        on:toggleStar={(e) => toggleStar(e.detail.item)}
        on:toggleRead={(e) => toggleRead(e.detail.item)}
      />
      <div bind:this={sentinel} class="h-4 w-full"></div>
    {/if}
  </div>
{/if}

<OnboardingFlow />
<BulkActionsBar />
<KeyboardShortcutsHelp shortcuts={$shortcuts} />
<ReadingStatsModal bind:isOpen={showStats} />

<svelte:window on:keydown={handleKeydown} />

<style>
  :global(body) {
    overflow-x: hidden;
    max-width: 100vw;
  }

  /* Fix for sticky positioning - ensure no parent interferes */
  :global(html, body) {
    overflow-x: hidden;
    overflow-y: auto;
  }

  .sticky-header {
    position: sticky;
    top: 0;
    z-index: 20;
    background-color: var(--tw-colors-background);
    padding: 24px 0 16px 0;
    border-bottom: 1px solid theme("colors.stroke");
  }

  /* Ensure articles scroll properly below sticky header */
  .articles-list {
    position: relative;
    z-index: 1;
  }

  .mobile-sticky-filters {
    position: fixed;
    top: var(--mobile-header-height, 52px);
    left: 0;
    right: 0;
    z-index: 25;
    background: theme("colors.background");
    padding: 12px 0;
    border-bottom: 1px solid theme("colors.stroke");
  }

  .page-header {
    margin-bottom: 12px;
  }

  .page-header h1 {
    font-size: 28px;
    font-weight: 700;
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
    .page-header {
      margin-bottom: 12px;
    }

    .articles-list {
      padding-top: calc(
        var(--mobile-header-height, 52px) + var(--mobile-filters-height, 60px)
      );
    }
  }
  .desktop-search {
    max-height: 0;
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
  }

  .desktop-search.open {
    max-height: 80px;
    opacity: 1;
  }
</style>
