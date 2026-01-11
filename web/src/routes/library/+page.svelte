<script lang="ts">
  import { onMount } from "svelte";
  import { Star, Bookmark, Filter, ArrowUpDown, Rss, Youtube, Hash, Radio, CheckCircle2, Circle } from "lucide-svelte";
  import FeedGrid from "$lib/components/FeedGrid.svelte";
  import SearchBar from "$lib/components/SearchBar.svelte";
  import SkeletonCard from "$lib/components/SkeletonCard.svelte";
  import { playMedia } from "$lib/stores/media";
  import type { Item } from "$lib/types";
  import { toggleRead, toggleStar } from "$lib/stores/items";

  let items: Item[] = [];
  let loading = false;
  let error: string | null = null;

  // Filtering and sorting
  let typeFilter: "all" | "rss" | "youtube" | "reddit" | "podcast" = "all";
  let readFilter: "all" | "read" | "unread" = "all";
  let sortBy: "recent" | "oldest" | "title" = "recent";
  let searchQuery = "";

  // Search state
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Filter options - matching Add Feeds modal style
  const typeFilters = [
    { value: "all" as const, label: "All" },
    { value: "rss" as const, label: "RSS", icon: Rss, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { value: "youtube" as const, label: "YouTube", icon: Youtube, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
    { value: "reddit" as const, label: "Reddit", icon: Hash, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    { value: "podcast" as const, label: "Podcast", icon: Radio, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  ];

  const readFilters = [
    { value: "all" as const, label: "All", icon: null, color: "", bg: "bg-accent", border: "border-accent" },
    { value: "unread" as const, label: "Unread", icon: Circle, color: "text-white/60", bg: "bg-white/5", border: "border-white/10" },
    { value: "read" as const, label: "Read", icon: CheckCircle2, color: "text-white/60", bg: "bg-white/5", border: "border-white/10" },
  ];

  function handleSearchInput() {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      // Filter items will react to searchQuery change
    }, 300);
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      searchQuery = "";
    }
  }

  function clearSearch() {
    searchQuery = "";
  }

  onMount(() => {
    loadStarredItems();
  });

  async function loadStarredItems() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams({
        starredOnly: "1",
        limit: "500",
        offset: "0",
      });

      const response = await fetch(`/api/items?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      items = data.items || [];
    } catch (err) {
      error =
        err instanceof Error ? err.message : "Failed to load starred items";
    } finally {
      loading = false;
    }
  }

  // Filtered and sorted items
  $: filteredItems = items
    .filter((item) => {
      // Type filter
      if (typeFilter !== "all") {
        const itemSource = (item.source || "").toLowerCase();
        if (!itemSource.includes(typeFilter)) {
          return false;
        }
      }

      // Read filter
      if (readFilter === "read" && item.is_read !== 1) return false;
      if (readFilter === "unread" && item.is_read !== 0) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          item.title?.toLowerCase().includes(query) ||
          item.summary?.toLowerCase().includes(query) ||
          item.author?.toLowerCase().includes(query)
        );
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return (a.published || a.created_at || "").localeCompare(b.published || b.created_at || "");
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        default: // recent
          return (b.published || b.created_at || "").localeCompare(a.published || a.created_at || "");
      }
    });

  async function handleToggleRead(item: Item) {
    await toggleRead(item);
    // Reload to get fresh data
    await loadStarredItems();
  }

  async function handleToggleStar(item: Item) {
    await toggleStar(item);
    // Reload to get fresh data - item will disappear from library
    await loadStarredItems();
  }

  function handleArticleClick(item: Item) {
    // Open reader view or navigate to article
    if (item.url) {
      window.open(item.url, "_blank");
    }
  }
</script>

<svelte:head>
  <title>Library - FeedStream</title>
</svelte:head>

<div class="max-w-7xl mx-auto">
  <!-- Page Header -->
  <div class="page-header">
    <div class="flex items-center justify-between">
      <h1 class="text-3xl font-bold text-white">Library</h1>
    </div>
  </div>

  <!-- Search Bar -->
  {#if !loading && items.length > 0}
    <div class="search-bar-full">
      <SearchBar
        value={searchQuery}
        placeholder="Search your library..."
        onInput={handleSearchInput}
        onClear={clearSearch}
        onKeydown={handleSearchKeydown}
      />
    </div>

    <!-- Filter Pills - Type Filter -->
    <div class="flex items-center gap-2 mb-3 flex-wrap">
      <span class="text-xs font-semibold text-white/60 uppercase tracking-wider">Type:</span>
      {#each typeFilters as filter}
        <button
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 border {typeFilter === filter.value
            ? `${filter.bg} ${filter.color} ${filter.border}`
            : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}"
          on:click={() => (typeFilter = filter.value)}
        >
          {#if filter.icon}
            <svelte:component this={filter.icon} size={14} />
          {/if}
          {filter.label}
        </button>
      {/each}
    </div>

    <!-- Filter Pills - Read Status Filter -->
    <div class="flex items-center gap-2 mb-3 flex-wrap">
      <span class="text-xs font-semibold text-white/60 uppercase tracking-wider">Status:</span>
      {#each readFilters as filter}
        <button
          class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 border {readFilter === filter.value
            ? `${filter.bg} text-white ${filter.border}`
            : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}"
          on:click={() => (readFilter = filter.value)}
        >
          {#if filter.icon}
            <svelte:component this={filter.icon} size={14} />
          {/if}
          {filter.label}
        </button>
      {/each}
    </div>

    <!-- Sort -->
    <div class="flex items-center justify-end gap-2 mb-4">
      <ArrowUpDown size={16} class="text-white/60" />
      <select
        bind:value={sortBy}
        class="bg-white/5 px-3 py-1.5 rounded-lg text-sm text-white border border-white/10 hover:bg-white/10 transition-colors outline-none"
      >
        <option value="recent">Recently Added</option>
        <option value="oldest">Oldest First</option>
        <option value="title">Title A-Z</option>
      </select>
    </div>
  {/if}

  <!-- Loading State -->
  {#if loading}
    <div class="flex flex-col gap-0 w-full">
      {#each Array(5) as _ (Math.random())}
        <SkeletonCard />
      {/each}
    </div>
  {:else if error}
    <!-- Error State -->
    <div
      class="glass rounded-2xl p-8 text-center border border-red-500/20 bg-red-500/5"
    >
      <p class="text-red-400">{error}</p>
      <button
        class="mt-4 px-4 py-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors text-white"
        on:click={loadStarredItems}
      >
        Try Again
      </button>
    </div>
  {:else if items.length === 0}
    <!-- Empty State -->
    <div class="glass rounded-2xl p-12 text-center">
      <div
        class="w-16 h-16 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-yellow-500/20"
      >
        <Star size={32} class="text-yellow-400" />
      </div>
      <h2 class="text-xl font-semibold text-white mb-2">
        No starred items yet
      </h2>
      <p class="text-white/60 mb-6">
        Star articles you want to save for later and they'll appear here
      </p>
      <a
        href="/"
        class="inline-block px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors"
      >
        Browse Articles
      </a>
    </div>
  {:else if filteredItems.length === 0}
    <!-- No Results -->
    <div class="glass rounded-2xl p-12 text-center">
      <Filter size={32} class="text-white/40 mx-auto mb-4" />
      <h2 class="text-xl font-semibold text-white mb-2">No items match your filters</h2>
      <p class="text-white/60">Try adjusting your search or filters</p>
    </div>
  {:else}
    <!-- Starred Items Grid -->
    <FeedGrid
      items={filteredItems}
      on:open={(e) => handleArticleClick(e.detail.item)}
      on:toggleStar={(e) => handleToggleStar(e.detail.item)}
      on:toggleRead={(e) => handleToggleRead(e.detail.item)}
      on:play={(e) => playMedia(e.detail.item)}
    />
  {/if}
</div>

<style>
  /* Page Header - matching All Articles */
  .page-header {
    margin-bottom: 20px;
  }

  /* Search Bar Styles - matching All Articles */
  .search-bar-full {
    margin-bottom: 20px;
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .page-header {
      margin-bottom: 16px;
    }

    .search-bar-full {
      margin-bottom: 16px;
    }
  }
</style>
