<script lang="ts">
  import { onMount } from "svelte";
  import { Star, Bookmark, Filter, ArrowUpDown, Rss, Youtube, Hash, Radio, Search, X, CheckCircle2, Circle } from "lucide-svelte";
  import FeedGrid from "$lib/components/FeedGrid.svelte";
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
  <!-- Header -->
  <div class="mb-6">
    <h1 class="text-3xl font-bold text-white mb-2">Library</h1>
    <p class="text-white/60">
      Your saved and starred articles ({filteredItems.length}{filteredItems.length !== items.length ? ` of ${items.length}` : ""} item{filteredItems.length !== 1 ? "s" : ""})
    </p>
  </div>

  {#if !loading && items.length > 0}
    <!-- Filters and Controls -->
    <div class="glass rounded-2xl p-4 mb-6 space-y-4">
      <!-- Search Bar -->
      <div class="relative">
        <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          placeholder="Search your library..."
          bind:value={searchQuery}
          class="w-full bg-white/5 pl-10 pr-10 py-2.5 rounded-xl text-white placeholder-white/40 outline-none border border-white/10 focus:border-accent/50 transition-colors"
        />
        {#if searchQuery}
          <button
            on:click={() => searchQuery = ""}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
          >
            <X size={18} />
          </button>
        {/if}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Type Filter -->
        <div class="flex items-center gap-2">
          <Filter size={16} class="text-white/60" />
          <div class="flex gap-1 flex-wrap">
            {#each [
              { value: "all", label: "All" },
              { value: "rss", label: "RSS", icon: Rss, color: "text-emerald-500" },
              { value: "youtube", label: "YouTube", icon: Youtube, color: "text-red-500" },
              { value: "reddit", label: "Reddit", icon: Hash, color: "text-orange-500" },
              { value: "podcast", label: "Podcast", icon: Radio, color: "text-purple-500" },
            ] as filter}
              <button
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all {typeFilter === filter.value
                  ? 'bg-accent text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'}"
                on:click={() => (typeFilter = filter.value)}
              >
                {#if filter.icon}
                  <svelte:component this={filter.icon} size={14} class="inline mr-1 {filter.color}" />
                {/if}
                {filter.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Read Status Filter -->
        <div class="flex items-center gap-2">
          <div class="flex gap-1">
            {#each [
              { value: "all", label: "All" },
              { value: "unread", label: "Unread", icon: Circle },
              { value: "read", label: "Read", icon: CheckCircle2 },
            ] as filter}
              <button
                class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all {readFilter === filter.value
                  ? 'bg-accent text-white'
                  : 'bg-white/5 text-white/60 hover:bg-white/10'}"
                on:click={() => (readFilter = filter.value)}
              >
                {filter.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Sort -->
        <div class="flex items-center gap-2 ml-auto">
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
      </div>
    </div>
  {/if}

  <!-- Loading State -->
  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="text-white/60">Loading your library...</div>
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
