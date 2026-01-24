<script lang="ts">
  import {
    X,
    PlusCircle,
    Rss,
    Loader2,
    CheckCircle2,
    Search,
    Youtube,
    Hash,
    Radio,
    ExternalLink,
    ChevronDown,
  } from "lucide-svelte";
  import { createFeed } from "$lib/api/feeds";
  import { loadFeeds, refreshEvent, refreshFeed } from "$lib/stores/feeds";
  import { toast } from "$lib/stores/toast";
  import type { SearchResult } from "$lib/types";

  let searchQuery = "";
  let searching = false;
  let searchResults: SearchResult[] = [];
  let error: string | null = null;
  let successMessage: string | null = null;
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshing = false;
  let refreshMessage: string | null = null;
  let refreshProgress: { current: number; total: number } | null = null;
  let refreshError: string | null = null;
  let lastRefreshUrl: string | null = null;
  let searchFocused = false;
  let searchInput: HTMLInputElement;

  // Type filters - using Set for multi-select
  type FeedType = "rss" | "youtube" | "reddit" | "podcast";
  let selectedTypes = new Set<FeedType>([
    "rss",
    "youtube",
    "reddit",
    "podcast",
  ]);

  const typeOptions = [
    {
      value: "rss" as FeedType,
      label: "RSS Feeds",
      icon: Rss,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      hover: "hover:bg-emerald-500/20",
    },
    {
      value: "youtube" as FeedType,
      label: "YouTube",
      icon: Youtube,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      hover: "hover:bg-red-500/20",
    },
    {
      value: "reddit" as FeedType,
      label: "Reddit",
      icon: Hash,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      hover: "hover:bg-orange-500/20",
    },
    {
      value: "podcast" as FeedType,
      label: "Podcasts",
      icon: Radio,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      hover: "hover:bg-cyan-500/20",
    },
  ];

  function toggleTypeFilter(type: FeedType) {
    if (selectedTypes.has(type)) {
      selectedTypes.delete(type);
    } else {
      selectedTypes.add(type);
    }
    selectedTypes = selectedTypes; // Trigger reactivity

    // Re-search with new filters
    if (searchQuery.trim()) {
      searchFeeds();
    }
  }

  async function searchFeeds() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    searching = true;
    error = null;

    try {
      // Build type parameter
      const types = Array.from(selectedTypes).join(",");
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        type: types || "all",
      });

      const response = await fetch(`/api/feeds/search?${params}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      searchResults = data.results || [];
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to search feeds";
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function handleSearchInput() {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    searchDebounceTimer = setTimeout(() => {
      searchFeeds();
    }, 400);
  }

  function focusSearch() {
    searchFocused = true;
    if (searchInput) {
      searchInput.focus();
    }
  }

  function blurSearch() {
    if (!searchQuery) {
      searchFocused = false;
    }
  }

  function waitForRefresh(jobId: string) {
    return new Promise<void>((resolve, reject) => {
      const unsubscribe = refreshEvent.subscribe((event) => {
        if (!event || event.jobId !== jobId) return;

        refreshMessage = event.message || "Refreshing feed...";
        if (
          typeof event.current === "number" &&
          typeof event.total === "number"
        ) {
          refreshProgress = { current: event.current, total: event.total };
        }

        if (event.type === "complete") {
          unsubscribe();
          refreshMessage = null;
          refreshProgress = null;
          resolve();
        }
        if (event.type === "error") {
          unsubscribe();
          refreshMessage = null;
          refreshProgress = null;
          reject(new Error(event.message || "Feed refresh failed"));
        }
      });
    });
  }

  async function handleAddFeed(url: string, title: string) {
    try {
      await createFeed(url, [], title);

      // Immediately refresh the feed to fetch title and items
      try {
        refreshError = null;
        lastRefreshUrl = url;
        const jobId = await refreshFeed(url);
        refreshing = true;
        refreshMessage = "Starting refresh...";
        await waitForRefresh(jobId);
        await loadFeeds();
        refreshing = false;
        refreshError = null;
        refreshProgress = null;
      } catch (refreshErr) {
        console.warn("Failed to refresh feed after adding:", refreshErr);
        refreshing = false;
        refreshError =
          refreshErr instanceof Error
            ? refreshErr.message
            : "Failed to refresh feed";
        refreshProgress = null;
      }

      toast.success(`Added "${title}" successfully!`);

      // Remove from results
      searchResults = searchResults.filter((r) => r.url !== url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add feed");
    }
  }

  async function retryRefresh() {
    if (!lastRefreshUrl || refreshing) return;

    try {
      refreshError = null;
      const jobId = await refreshFeed(lastRefreshUrl);
      refreshing = true;
      refreshMessage = "Starting refresh...";
      await waitForRefresh(jobId);
      await loadFeeds();
      refreshing = false;
      refreshError = null;
      refreshProgress = null;
    } catch (refreshErr) {
      console.warn("Failed to refresh feed after retry:", refreshErr);
      refreshing = false;
      refreshError =
        refreshErr instanceof Error
          ? refreshErr.message
          : "Failed to refresh feed";
      refreshProgress = null;
    }
  }

  function getSourceStyle(type: string) {
    const option = typeOptions.find((t) => t.value === type);
    return option || typeOptions[0];
  }
</script>

<div class="pb-20">
  <!-- Header -->
  <div class="mb-8">
    <div class="flex items-center gap-3 mb-2">
      <div
        class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20"
      >
        <Search size={20} class="text-white" />
      </div>
      <h2 class="text-2xl font-bold text-white">Add Feed</h2>
    </div>
    <p class="text-zinc-400">
      Search and add RSS feeds, YouTube channels, Reddit communities, and podcasts.
    </p>
  </div>

  <!-- Content -->
  <div class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
    <!-- Search & Filters Section -->
    <div class="px-6 pt-5 pb-4 space-y-4">
      <!-- Collapsible Search Bar -->
      <div class="relative">
        <Search
          size={20}
          class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          bind:this={searchInput}
          type="text"
          placeholder="Search: 'omgubuntu', 'tech news', 'cooking podcasts'..."
          bind:value={searchQuery}
          on:input={handleSearchInput}
          on:focus={() => (searchFocused = true)}
          on:blur={blurSearch}
          class="w-full bg-zinc-950 pl-12 pr-12 py-3.5 rounded-xl text-white placeholder-zinc-600 border border-zinc-800 focus:border-emerald-500/50 transition-colors outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
        {#if searchQuery}
          <button
            class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-white"
            on:click={() => {
              searchQuery = "";
              searchResults = [];
              searchFocused = false;
            }}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        {/if}
        {#if searching}
          <div class="absolute right-10 top-1/2 -translate-y-1/2">
            <Loader2 size={16} class="animate-spin text-zinc-500" />
          </div>
        {/if}
      </div>

      <!-- Type Filters - Grid Layout -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {#each typeOptions as option}
          <button
            class="px-3 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 {selectedTypes.has(
              option.value,
            )
              ? `${option.bg} ${option.color} border ${option.border}`
              : 'bg-zinc-950 text-zinc-500 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'}"
            on:click={() => toggleTypeFilter(option.value)}
          >
            <svelte:component this={option.icon} size={16} />
            <span>{option.label}</span>
          </button>
        {/each}
      </div>

      <!-- Refresh Status -->
      {#if refreshing}
        <div
          class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-300 text-sm flex items-center gap-2"
        >
          <Loader2 size={16} class="animate-spin text-zinc-500" />
          <span class="flex-1">{refreshMessage || "Refreshing feed..."}</span>
          {#if refreshProgress}
            <span class="text-xs text-zinc-500 tabular-nums">
              {refreshProgress.current}/{refreshProgress.total}
            </span>
          {/if}
        </div>
      {/if}

      {#if refreshError}
        <div
          class="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between gap-3"
        >
          <span class="flex-1">{refreshError}</span>
          <button
            class="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-medium transition-colors disabled:opacity-50"
            on:click={retryRefresh}
            disabled={refreshing || !lastRefreshUrl}
          >
            {#if refreshing}
              <span class="flex items-center gap-1.5">
                <Loader2 size={12} class="animate-spin" />
                Refreshing
              </span>
            {:else}
              Retry
            {/if}
          </button>
        </div>
      {/if}

      <!-- Error Message -->
      {#if error}
        <div
          class="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
        >
          {error}
        </div>
      {/if}
    </div>

    <!-- Results -->
    <div class="border-t border-zinc-800 min-h-[300px]">
      {#if searchQuery && !searching && searchResults.length === 0}
        <!-- No Results -->
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div
            class="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800"
          >
            <Search size={32} class="text-zinc-600" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">
            No feeds found
          </h3>
          <p class="text-zinc-500 text-sm max-w-xs mx-auto">
            Try different keywords or adjust your filters to find what you're looking for.
          </p>
        </div>
      {:else if searchResults.length > 0}
        <!-- Results List -->
        <div class="divide-y divide-zinc-800">
          {#each searchResults as result}
            {@const sourceStyle = getSourceStyle(result.type)}
            <div
              class="p-4 hover:bg-zinc-950/50 transition-colors group"
            >
              <div class="flex items-start gap-4">
                <!-- Thumbnail/Icon -->
                <div
                  class="w-12 h-12 rounded-lg bg-zinc-950 border border-zinc-800 flex-shrink-0 overflow-hidden flex items-center justify-center"
                >
                  {#if result.thumbnail}
                    <img
                      src={result.thumbnail}
                      alt={result.title}
                      class="w-full h-full object-cover"
                    />
                  {:else}
                    <svelte:component
                      this={sourceStyle.icon}
                      size={20}
                      class={sourceStyle.color}
                    />
                  {/if}
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-3 mb-1">
                    <h4 class="font-semibold text-white truncate text-base">
                      {result.title}
                    </h4>
                    <div
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border {sourceStyle.border} {sourceStyle.color} bg-zinc-950 flex-shrink-0"
                    >
                      {result.type}
                    </div>
                  </div>
                  {#if result.description}
                    <p class="text-sm text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
                      {result.description}
                    </p>
                  {/if}

                  <!-- Actions -->
                  <div class="flex items-center gap-2">
                    <button
                      class="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-black font-semibold rounded-lg transition-colors text-sm"
                      on:click={() => handleAddFeed(result.url, result.title)}
                    >
                      <PlusCircle size={14} />
                      Add
                    </button>
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-sm text-zinc-300 hover:text-white"
                    >
                      <ExternalLink size={14} />
                      Visit
                    </a>
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <!-- Initial State -->
        <div class="flex flex-col items-center justify-center py-20 text-center">
          <div
            class="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800"
          >
            <Search size={32} class="text-zinc-600" />
          </div>
          <h3 class="text-lg font-semibold text-white mb-2">
            Start discovering feeds
          </h3>
          <p class="text-zinc-500 text-sm max-w-xs mx-auto">
            Use the search bar above to find RSS feeds, YouTube channels,
            Reddit communities, and podcasts.
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
