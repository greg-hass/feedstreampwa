<script lang="ts">
  import { onMount } from "svelte";
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
    toggleRead,
    toggleStar,
    searchQuery,
    setSearchQuery,
    timeFilter,
    setTimeFilter,
    hasMore,
  } from "$lib/stores/items";
  import {
    loadFeeds,
    refreshAll as refreshAllFeeds,
    refreshState,
  } from "$lib/stores/feeds";
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

  // Watch for refresh completion to reload items
  $: {
    if (wasRefreshing && !$refreshState.isRefreshing) {
      loadItems({ ...getLoadParams(), refresh: true });
    }
    wasRefreshing = $refreshState.isRefreshing;
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

  // Filter items based on time
  $: filteredItems = (() => {
    if ($timeFilter === "all") return $items;

    const now = new Date();
    let cutoffDate: Date;

    switch ($timeFilter) {
      case "today":
      case "24h":
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        return $items;
    }

    return $items.filter((item) => {
      const itemDate = new Date(
        item.published || item.published_at || item.created_at
      );
      return itemDate >= cutoffDate;
    });
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
    return params;
  }

  function loadMore() {
    loadItems({ ...getLoadParams(), refresh: false });
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

  // Reactive reload
  $: if (
    $viewMode ||
    $activeSmartFolder ||
    $activeFolderId ||
    $selectedFeedUrl
  ) {
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
          <button
            class="p-2.5 rounded-xl bg-[#3f3f46] hover:bg-[#52525b] transition-all shadow-lg shadow-black/20 text-white"
            on:click={refreshAll}
            class:spinning={$refreshState.isRefreshing}
            title="Refresh"
          >
            <RefreshCw size={20} />
          </button>
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
    <FilterChips
      timeFilter={$timeFilter}
      on:change={(e) => setTimeFilter(e.detail)}
    />
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
  />

  <!-- Sticky Filter Chips for Mobile -->
  <div class="mobile-sticky-filters">
    <FilterChips
      timeFilter={$timeFilter}
      on:change={(e) => setTimeFilter(e.detail)}
    />
  </div>
{/if}

<!-- Articles List -->
<div class="articles-list">
  {#if $itemsLoading && $items.length === 0}
    <div class="flex flex-col gap-0 w-full">
      {#each Array(5) as _ (Math.random())}
        <SkeletonCard density={$viewDensity} />
      {/each}
    </div>
  {:else if $itemsError}
    <div class="empty-state error">{$itemsError}</div>
  {:else if filteredItems.length === 0}
    <div class="empty-state">
      No articles found. Add some feeds to get started!
    </div>
  {:else}
    <FeedGrid
      items={filteredItems}
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
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  /* Mobile Fixed Filter Chips */
  .mobile-sticky-filters {
    position: fixed;
    top: 52px; /* Height of MobileHeader */
    left: 0;
    right: 0;
    z-index: 25;
    background: theme("colors.background");
    padding: 12px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
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
      padding-top: 96px; /* Space for fixed mobile header + filters */
    }
  }
</style>
