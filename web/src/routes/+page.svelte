<script lang="ts">
  import { onMount } from "svelte";
  import { RefreshCw, Plus } from "lucide-svelte";

  // Components
  import MobileHeader from "$lib/components/MobileHeader.svelte";
  import FeedGrid from "$lib/components/FeedGrid.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import SkeletonCard from "$lib/components/SkeletonCard.svelte";
  import FilterChips from "$lib/components/FilterChips.svelte";
  import ReaderView from "$lib/components/ReaderView.svelte";
  import RefreshToast from "$lib/components/RefreshToast.svelte";
  import ContextMenu from "$lib/components/ContextMenu.svelte";

  // Modals
  import CreateFolderModal from "$lib/components/modals/CreateFolderModal.svelte";
  import RenameModal from "$lib/components/modals/RenameModal.svelte";
  import FeedFolderPopover from "$lib/components/modals/FeedFolderPopover.svelte";

  // Stores
  import {
    isAddFeedModalOpen,
    viewMode,
    activeSmartFolder,
    activeFolderId,
    selectedFeedUrl,
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
  import { loadFeeds, refreshAll, refreshState } from "$lib/stores/feeds";
  import { loadFolders, folders } from "$lib/stores/folders";
  import { openReader } from "$lib/stores/reader";
  import { playMedia } from "$lib/stores/media";

  // Local state
  let isMobile = false;
  let sentinel: HTMLElement;

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
      return "Starred";
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
      const itemDate = new Date(item.published_at || item.created_at);
      return itemDate >= cutoffDate;
    });
  })();

  function getLoadParams() {
    const params: any = {};
    if ($viewMode === "feed" && $selectedFeedUrl) params.feedUrl = $selectedFeedUrl;
    if ($viewMode === "smart" && $activeSmartFolder) params.smartFolder = $activeSmartFolder;
    if ($viewMode === "folder" && $activeFolderId) params.folderId = $activeFolderId;
    if ($viewMode === "unread") params.unreadOnly = true;
    if ($viewMode === "bookmarks") params.starredOnly = true;
    return params;
  }

  function loadMore() {
    loadItems({ ...getLoadParams(), refresh: false });
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
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && $hasMore && !$itemsLoading) {
             loadMore();
        }
    }, { rootMargin: '400px' });
    
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

<!-- Content -->
{#if isMobile}
  <MobileHeader
    bind:searchQuery={$searchQuery}
    onSearchInput={() => loadItems()} 
    onSearchClear={() => { setSearchQuery(''); loadItems(); }}
    onRefresh={refreshAll}
    isRefreshing={$refreshState.isRefreshing}
  />
{:else}
  <!-- Page Header -->
  <div class="page-header">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold text-white">{pageTitle}</h1>
      <div class="flex items-center gap-2">
        <button
          class="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/20 text-white"
          on:click={refreshAll}
          class:spinning={$refreshState.isRefreshing}
          title="Refresh"
        >
          <RefreshCw size={20} />
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
      onClear={() => { setSearchQuery(''); loadItems(); }}
    />
  </div>
{/if}

<!-- Filter Chips -->
<FilterChips
  timeFilter={$timeFilter}
  on:change={(e) => setTimeFilter(e.detail)}
/>

<!-- Articles List -->
<div class="articles-list">
  {#if $itemsLoading && $items.length === 0}
    <div class="flex flex-col gap-0 w-full">
      {#each Array(5) as _ (Math.random())}
        <SkeletonCard />
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
      on:open={(e) => openReader(e.detail.item)}
      on:toggleStar={(e) => toggleStar(e.detail.item)}
      on:toggleRead={(e) => toggleRead(e.detail.item)}
      on:play={(e) => playMedia(e.detail.item)}
    />
    
    <!-- Loading spinner at bottom for infinite scroll -->
    {#if $itemsLoading}
       <div class="py-4 flex justify-center">
         <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
       </div>
    {/if}
    
    <div bind:this={sentinel} class="h-4 w-full"></div>
  {/if}
</div>

<!-- Modals & Overlays -->
<ReaderView />
<CreateFolderModal />
<RenameModal />
<FeedFolderPopover />
<ContextMenu />
<RefreshToast />

<style>
  /* Page Header */
  .page-header {
    margin-bottom: 20px;
    /* padding removed - handled by layout */
  }

  .page-header h1 {
    font-size: 28px;
    font-weight: 700;
  }

  .search-bar-full {
    margin-bottom: 20px;
  }

  .articles-list {
    display: flex;
    flex-direction: column;
    /* Removed overflow/height constraints to allow window scrolling */
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
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    .page-header, .search-bar-full {
        margin-bottom: 16px;
    }
  }
</style>