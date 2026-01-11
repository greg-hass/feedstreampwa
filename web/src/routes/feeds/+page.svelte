<script lang="ts">
  import { onMount } from "svelte";
  import {
    Rss,
    Trash2,
    RefreshCw,
    Plus,
    ExternalLink,
    Filter,
    ArrowUpDown,
    Check,
    Youtube,
    Hash,
    Radio,
    Search,
    X,
    FolderPlus,
  } from "lucide-svelte";
  import { isAddFeedModalOpen } from "$lib/stores/ui";
  import { toast } from "$lib/stores/toast";
  import { confirmDialog } from "$lib/stores/confirm";
  import SkeletonCard from "$lib/components/SkeletonCard.svelte";
  import type { Feed } from "$lib/types";

  let feeds: Feed[] = [];
  let loading = false;
  let error: string | null = null;

  // Filtering and sorting
  let typeFilter: "all" | "rss" | "youtube" | "reddit" | "podcast" = "all";
  let sortBy: "name" | "unread" | "recent" = "name";
  let searchQuery = "";

  // Bulk selection
  let selectedFeeds = new Set<string>();
  let bulkActionInProgress = false;

  // Type filter options
  const typeFilters = [
    { value: "all" as const, label: "All" },
    { value: "rss" as const, label: "RSS", icon: Rss, color: "text-emerald-500" },
    { value: "youtube" as const, label: "YouTube", icon: Youtube, color: "text-red-500" },
    { value: "reddit" as const, label: "Reddit", icon: Hash, color: "text-orange-500" },
    { value: "podcast" as const, label: "Podcast", icon: Radio, color: "text-purple-500" },
  ];

  onMount(() => {
    loadFeeds();
  });

  async function loadFeeds() {
    loading = true;
    error = null;

    try {
      const response = await fetch("/api/feeds");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      feeds = data.feeds || [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load feeds";
    } finally {
      loading = false;
    }
  }

  // Filtered and sorted feeds
  $: filteredFeeds = feeds
    .filter((feed) => {
      // Type filter
      if (typeFilter !== "all" && feed.type !== typeFilter && feed.kind !== typeFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          feed.title?.toLowerCase().includes(query) ||
          feed.url.toLowerCase().includes(query) ||
          feed.description?.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "unread":
          return (b.unreadCount || 0) - (a.unreadCount || 0);
        case "recent":
          return (b.created_at || "").localeCompare(a.created_at || "");
        default: // name
          return (a.title || a.url).localeCompare(b.title || b.url);
      }
    });

  $: allSelected = filteredFeeds.length > 0 && filteredFeeds.every(f => selectedFeeds.has(f.url));
  $: someSelected = selectedFeeds.size > 0 && !allSelected;

  function toggleSelectAll() {
    if (allSelected) {
      selectedFeeds.clear();
    } else {
      filteredFeeds.forEach(f => selectedFeeds.add(f.url));
    }
    selectedFeeds = selectedFeeds; // Trigger reactivity
  }

  function toggleSelect(url: string) {
    if (selectedFeeds.has(url)) {
      selectedFeeds.delete(url);
    } else {
      selectedFeeds.add(url);
    }
    selectedFeeds = selectedFeeds; // Trigger reactivity
  }

  async function deleteFeed(url: string) {
    const confirmed = await confirmDialog.confirm({
      title: "Unsubscribe from Feed",
      message: "Are you sure you want to unsubscribe from this feed?",
      confirmText: "Unsubscribe",
      cancelText: "Cancel",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/feeds?url=${encodeURIComponent(url)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete feed");
      }

      selectedFeeds.delete(url);
      await loadFeeds();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete feed");
    }
  }

  async function bulkDelete() {
    if (selectedFeeds.size === 0) return;

    const confirmed = await confirmDialog.confirm({
      title: "Delete Feeds",
      message: `Delete ${selectedFeeds.size} selected feed(s)?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      type: "danger",
    });

    if (!confirmed) return;

    bulkActionInProgress = true;
    const urls = Array.from(selectedFeeds);

    for (const url of urls) {
      try {
        await fetch(`/api/feeds?url=${encodeURIComponent(url)}`, { method: "DELETE" });
      } catch (err) {
        console.error(`Failed to delete ${url}:`, err);
      }
    }

    selectedFeeds.clear();
    bulkActionInProgress = false;
    await loadFeeds();
  }

  async function bulkRefresh() {
    if (selectedFeeds.size === 0) return;

    bulkActionInProgress = true;

    try {
      const response = await fetch("/api/refresh/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: Array.from(selectedFeeds) }),
      });

      if (!response.ok) {
        throw new Error("Failed to refresh feeds");
      }

      toast.success(`Refresh started for ${selectedFeeds.size} feed(s)!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh feeds");
    } finally {
      bulkActionInProgress = false;
    }
  }

  async function refreshFeed(url: string) {
    try {
      const response = await fetch("/api/refresh/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: [url] }),
      });

      if (!response.ok) {
        throw new Error("Failed to refresh feed");
      }

      toast.success("Feed refresh started!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to refresh feed");
    }
  }

  function getSourceIcon(type: string) {
    switch (type) {
      case "youtube":
        return { icon: Youtube, color: "text-red-500" };
      case "reddit":
        return { icon: Hash, color: "text-orange-500" };
      case "podcast":
        return { icon: Radio, color: "text-purple-500" };
      default:
        return { icon: Rss, color: "text-emerald-500" };
    }
  }
</script>

<svelte:head>
  <title>Feed Manager - FeedStream</title>
</svelte:head>

<div class="max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-3xl font-bold text-white">Feed Manager</h1>
    <div class="flex items-center gap-2">
      <button
        class="p-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 transition-colors shadow-lg shadow-amber-400/20 text-black"
        title="Add Folder"
      >
        <FolderPlus size={20} />
      </button>
      <button
        class="p-2.5 rounded-xl bg-accent hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 text-white"
        on:click={() => isAddFeedModalOpen.set(true)}
        title="Add Feed"
      >
        <Plus size={20} />
      </button>
    </div>
  </div>

  {#if !loading && feeds.length > 0}
    <!-- Filters and Controls -->
    <div class="glass rounded-2xl p-4 mb-6 space-y-4">
      <!-- Search Bar -->
      <div class="relative">
        <Search size={18} class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input
          type="text"
          placeholder="Search feeds..."
          bind:value={searchQuery}
          class="w-full bg-[rgba(255,255,255,0.03)] pl-11 pr-11 py-3 rounded-full text-white placeholder-white/40 outline-none border border-white/15 focus:border-accent/50 focus:bg-[rgba(255,255,255,0.05)] transition-all"
        />
        {#if searchQuery}
          <button
            on:click={() => searchQuery = ""}
            class="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        {/if}
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <!-- Type Filter -->
        <div class="flex items-center gap-2">
          <Filter size={16} class="text-white/60" />
          <div class="flex gap-1">
            {#each typeFilters as filter}
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

        <!-- Sort -->
        <div class="flex items-center gap-2 ml-auto">
          <ArrowUpDown size={16} class="text-white/60" />
          <select
            bind:value={sortBy}
            class="bg-white/5 px-3 py-1.5 rounded-lg text-sm text-white border border-white/10 hover:bg-white/10 transition-colors outline-none"
          >
            <option value="name">Name</option>
            <option value="unread">Unread Count</option>
            <option value="recent">Recently Added</option>
          </select>
        </div>
      </div>

      <!-- Bulk Actions -->
      {#if selectedFeeds.size > 0}
        <div class="flex items-center gap-3 pt-3 border-t border-white/10">
          <span class="text-sm text-white/60">{selectedFeeds.size} selected</span>
          <button
            class="flex items-center gap-2 px-3 py-1.5 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors text-sm"
            on:click={bulkRefresh}
            disabled={bulkActionInProgress}
          >
            <RefreshCw size={14} />
            Refresh Selected
          </button>
          <button
            class="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
            on:click={bulkDelete}
            disabled={bulkActionInProgress}
          >
            <Trash2 size={14} />
            Delete Selected
          </button>
          <button
            class="text-sm text-white/60 hover:text-white transition-colors ml-auto"
            on:click={() => selectedFeeds.clear()}
          >
            Clear Selection
          </button>
        </div>
      {/if}
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
        on:click={loadFeeds}
      >
        Try Again
      </button>
    </div>
  {:else if feeds.length === 0}
    <!-- Empty State -->
    <div class="glass rounded-2xl p-12 text-center">
      <div
        class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4"
      >
        <Rss size={32} class="text-white/40" />
      </div>
      <h2 class="text-xl font-semibold text-white mb-2">No feeds yet</h2>
      <p class="text-white/60 mb-6">
        Start by adding your first RSS feed, podcast, or YouTube channel
      </p>
      <button
        class="px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors"
        on:click={() => isAddFeedModalOpen.set(true)}
      >
        Add Your First Feed
      </button>
    </div>
  {:else if filteredFeeds.length === 0}
    <!-- No Results -->
    <div class="glass rounded-2xl p-12 text-center">
      <Filter size={32} class="text-white/40 mx-auto mb-4" />
      <h2 class="text-xl font-semibold text-white mb-2">No feeds match your filters</h2>
      <p class="text-white/60">Try adjusting your search or filters</p>
    </div>
  {:else}
    <!-- Feeds List with horizontal card layout matching Dashboard -->
    <div class="flex flex-col gap-0 w-full">
      <!-- Select All Header -->
      {#if filteredFeeds.length > 1}
        <div class="flex items-center gap-3 px-2 py-3 border-b border-white/5">
          <button
            class="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
            on:click={toggleSelectAll}
          >
            <div class="w-5 h-5 rounded border-2 border-white/20 flex items-center justify-center {allSelected ? 'bg-accent border-accent' : someSelected ? 'bg-accent/50 border-accent' : ''}">
              {#if allSelected || someSelected}
                <Check size={14} class="text-white" />
              {/if}
            </div>
            {allSelected ? "Deselect All" : "Select All"}
          </button>
        </div>
      {/if}

      {#each filteredFeeds as feed (feed.url)}
        {@const sourceStyle = getSourceIcon(feed.type || feed.kind)}
        <article
          class="group flex flex-col sm:flex-row gap-3 sm:gap-4 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors"
        >
          <!-- Checkbox -->
          <button
            class="flex-shrink-0"
            on:click|stopPropagation={() => toggleSelect(feed.url)}
          >
            <div class="w-5 h-5 rounded border-2 border-white/20 flex items-center justify-center hover:border-accent transition-colors {selectedFeeds.has(feed.url) ? 'bg-accent border-accent' : ''}">
              {#if selectedFeeds.has(feed.url)}
                <Check size={14} class="text-white" />
              {/if}
            </div>
          </button>

          <!-- Feed Icon -->
          <div class="flex-shrink-0">
            <div class="w-6 h-6 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
              {#if feed.icon_url}
                <img
                  src={feed.icon_url}
                  alt={feed.title}
                  class="w-full h-full object-cover"
                />
              {:else}
                <svelte:component this={sourceStyle.icon} size={24} class={sourceStyle.color} />
              {/if}
            </div>
          </div>

          <!-- Feed Info -->
          <div class="flex-1 min-w-0 flex flex-col justify-between py-1">
            <!-- Title Row -->
            <div class="flex items-start justify-between gap-4 mb-1">
              <div class="flex-1 min-w-0">
                <h3 class="text-base sm:text-lg font-medium text-white truncate">
                  {feed.title || feed.url}
                </h3>
                <p class="text-xs sm:text-sm text-white/50 truncate">
                  {feed.url}
                </p>
              </div>

              <!-- Unread Badge -->
              {#if feed.unreadCount && feed.unreadCount > 0}
                <div class="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm font-medium flex-shrink-0">
                  {feed.unreadCount} unread
                </div>
              {/if}
            </div>

            <!-- Description -->
            {#if feed.description}
              <p class="text-xs sm:text-sm text-white/40 line-clamp-1 leading-relaxed">
                {feed.description}
              </p>
            {/if}

            <!-- Actions -->
            <div class="flex items-center gap-1 mt-2">
              <button
                class="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-accent transition-colors"
                title="Refresh"
                on:click|stopPropagation={() => refreshFeed(feed.url)}
              >
                <RefreshCw size={18} />
              </button>

              <a
                href={feed.url}
                target="_blank"
                rel="noopener noreferrer"
                class="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
                title="Visit"
                on:click|stopPropagation
              >
                <ExternalLink size={18} />
              </a>

              <button
                class="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
                title="Unsubscribe"
                on:click|stopPropagation={() => deleteFeed(feed.url)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>
