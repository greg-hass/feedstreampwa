<script lang="ts">
  import { X, PlusCircle, Rss, Loader2, CheckCircle2, Search, Youtube, Hash, Radio, ExternalLink } from "lucide-svelte";
  import { isAddFeedModalOpen } from "$lib/stores/ui";
  import { createFeed, refreshFeed } from "$lib/api/feeds";
  import { loadFeeds } from "$lib/stores/feeds";
  import type { SearchResult } from "$lib/types";

  let searchQuery = "";
  let searching = false;
  let searchResults: SearchResult[] = [];
  let error: string | null = null;
  let successMessage: string | null = null;
  let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshPollTimer: ReturnType<typeof setInterval> | null = null;
  let refreshing = false;
  let refreshMessage: string | null = null;
  let refreshProgress: { current: number; total: number } | null = null;
  let refreshError: string | null = null;
  let lastRefreshUrl: string | null = null;

  // Type filters - using Set for multi-select
  type FeedType = "rss" | "youtube" | "reddit" | "podcast";
  let selectedTypes = new Set<FeedType>(["rss", "youtube", "reddit", "podcast"]);

  const typeOptions = [
    { value: "rss" as FeedType, label: "RSS", icon: Rss, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { value: "youtube" as FeedType, label: "YouTube", icon: Youtube, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
    { value: "reddit" as FeedType, label: "Reddit", icon: Hash, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    { value: "podcast" as FeedType, label: "Podcast", icon: Radio, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  ];

  function closeModal() {
    isAddFeedModalOpen.set(false);
    searchQuery = "";
    searchResults = [];
    error = null;
    successMessage = null;
    selectedTypes = new Set(["rss", "youtube", "reddit", "podcast"]);
    refreshing = false;
    refreshMessage = null;
    refreshError = null;
    lastRefreshUrl = null;
    refreshProgress = null;
  }

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

  async function pollRefreshStatus(jobId: string) {
    if (refreshPollTimer) clearInterval(refreshPollTimer);

    return new Promise<void>((resolve, reject) => {
      refreshPollTimer = setInterval(async () => {
        try {
          const response = await fetch(`/api/refresh/status?jobId=${encodeURIComponent(jobId)}`);
          const data = await response.json();

          if (!response.ok || data.status === "error") {
            if (refreshPollTimer) clearInterval(refreshPollTimer);
            refreshPollTimer = null;
            refreshMessage = null;
            refreshProgress = null;
            reject(new Error(data?.message || "Feed refresh failed"));
            return;
          }

          if (data.status === "done") {
            if (refreshPollTimer) clearInterval(refreshPollTimer);
            refreshPollTimer = null;
            refreshMessage = null;
            refreshProgress = null;
            resolve();
            return;
          }

          refreshMessage = data?.message || "Refreshing feed...";
          if (typeof data?.current === "number" && typeof data?.total === "number") {
            refreshProgress = { current: data.current, total: data.total };
          }
        } catch (err) {
          if (refreshPollTimer) clearInterval(refreshPollTimer);
          refreshPollTimer = null;
          refreshMessage = null;
          refreshProgress = null;
          reject(err);
        }
      }, 1200);
    });
  }

  async function handleAddFeed(url: string, title: string) {
    try {
      await createFeed(url, [], title);

      // Immediately refresh the feed to fetch title and items
      try {
        refreshError = null;
        lastRefreshUrl = url;
        const refreshResult = await refreshFeed(url);
        if (refreshResult?.jobId) {
          refreshing = true;
          await pollRefreshStatus(refreshResult.jobId);
          await loadFeeds();
          refreshing = false;
          refreshError = null;
          refreshProgress = null;
        }
      } catch (refreshErr) {
        console.warn("Failed to refresh feed after adding:", refreshErr);
        // Don't fail the whole operation if refresh fails
        refreshing = false;
        refreshError = refreshErr instanceof Error ? refreshErr.message : "Failed to refresh feed";
        refreshProgress = null;
      }

      successMessage = `Added "${title}" successfully!`;

      // Remove from results
      searchResults = searchResults.filter(r => r.url !== url);

      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage = null;
      }, 3000);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to add feed";
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      closeModal();
    }
  }

  async function retryRefresh() {
    if (!lastRefreshUrl || refreshing) return;

    try {
      refreshError = null;
      const refreshResult = await refreshFeed(lastRefreshUrl);
      if (refreshResult?.jobId) {
        refreshing = true;
        await pollRefreshStatus(refreshResult.jobId);
        await loadFeeds();
        refreshing = false;
        refreshError = null;
        refreshProgress = null;
      }
    } catch (refreshErr) {
      console.warn("Failed to refresh feed after retry:", refreshErr);
      refreshing = false;
      refreshError = refreshErr instanceof Error ? refreshErr.message : "Failed to refresh feed";
      refreshProgress = null;
    }
  }

  function getSourceStyle(type: string) {
    const option = typeOptions.find(t => t.value === type);
    return option || typeOptions[0];
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $isAddFeedModalOpen}
  <!-- Modal Backdrop -->
  <div
    class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
    on:click={closeModal}
    on:keydown={(e) => e.key === "Enter" && closeModal()}
    role="button"
    tabindex="-1"
  >
    <!-- Modal Content -->
    <div
      class="bg-surface rounded-2xl border border-white/5 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="bg-surface border-b border-white/5 px-6 py-4 flex items-center justify-between flex-shrink-0"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/20 flex items-center justify-center"
          >
            <Search size={20} class="text-emerald-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white">Discover Feeds</h2>
            <p class="text-sm text-white/60">
              Search for RSS, YouTube, Reddit, and Podcasts
            </p>
          </div>
        </div>
        <button
          class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          on:click={closeModal}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Search Bar -->
      <div class="px-6 pt-6 pb-4 space-y-4 flex-shrink-0">
        <div class="relative">
          <Search size={20} class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="Search: 'omgubuntu', 'tech news', 'cooking podcasts'..."
            bind:value={searchQuery}
            on:input={handleSearchInput}
            class="w-full bg-white/5 pl-12 pr-4 py-3.5 rounded-xl text-white placeholder-white/40 border border-white/10 hover:bg-white/10 focus:border-accent/50 transition-colors outline-none"
            autofocus
          />
          {#if searching}
            <div class="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 size={18} class="animate-spin text-white/40" />
            </div>
          {/if}
        </div>

        <!-- Type Filters -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-semibold text-white/60 uppercase tracking-wider">Filter:</span>
          {#each typeOptions as option}
            <button
              class="px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 {selectedTypes.has(option.value)
                ? `${option.bg} ${option.color} border ${option.border}`
                : 'bg-white/5 text-white/40 border border-white/10 hover:bg-white/10'}"
              on:click={() => toggleTypeFilter(option.value)}
            >
              <svelte:component this={option.icon} size={14} />
              {option.label}
            </button>
          {/each}
        </div>

        <!-- Success Message -->
        {#if successMessage}
          <div
            class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            {successMessage}
          </div>
        {/if}

        <!-- Refresh Status -->
        {#if refreshing}
          <div
            class="p-3 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm flex items-center gap-2"
          >
            <Loader2 size={16} class="animate-spin text-white/50" />
            <span class="flex-1">{refreshMessage || "Refreshing feed..."}</span>
            {#if refreshProgress}
              <span class="text-xs text-white/50 tabular-nums">
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
              class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 text-xs font-medium transition-colors disabled:opacity-50"
              on:click={retryRefresh}
              disabled={refreshing || !lastRefreshUrl}
            >
              {#if refreshing}
                <span class="flex items-center gap-1.5">
                  <Loader2 size={12} class="animate-spin text-white/70" />
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
      <div class="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
        {#if searchQuery && !searching && searchResults.length === 0}
          <!-- No Results -->
          <div class="glass rounded-2xl p-12 text-center">
            <div
              class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4"
            >
              <Search size={32} class="text-white/40" />
            </div>
            <h3 class="text-lg font-semibold text-white mb-2">No feeds found</h3>
            <p class="text-white/60 text-sm">
              Try different keywords or check your filters
            </p>
          </div>
        {:else if searchResults.length > 0}
          <!-- Results List -->
          <div class="space-y-3">
            {#each searchResults as result}
              {@const sourceStyle = getSourceStyle(result.type)}
              <div
                class="glass rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all"
              >
                <div class="flex items-start gap-4">
                  <!-- Thumbnail/Icon -->
                  <div
                    class="w-12 h-12 rounded-lg {sourceStyle.bg} border {sourceStyle.border} flex-shrink-0 overflow-hidden"
                  >
                    {#if result.thumbnail}
                      <img
                        src={result.thumbnail}
                        alt={result.title}
                        class="w-full h-full object-cover"
                      />
                    {:else}
                      <div class="w-full h-full flex items-center justify-center">
                        <svelte:component this={sourceStyle.icon} size={20} class={sourceStyle.color} />
                      </div>
                    {/if}
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-3 mb-1">
                      <h4 class="font-semibold text-white truncate">
                        {result.title}
                      </h4>
                      <div
                        class="{sourceStyle.bg} {sourceStyle.border} px-2 py-0.5 rounded-full text-xs font-medium {sourceStyle.color} uppercase border flex-shrink-0"
                      >
                        {result.type}
                      </div>
                    </div>
                    {#if result.description}
                      <p class="text-sm text-white/60 line-clamp-2 mb-3">
                        {result.description}
                      </p>
                    {/if}

                    <!-- Actions -->
                    <div class="flex items-center gap-2">
                      <button
                        class="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm shadow-lg shadow-accent/20"
                        on:click={() => handleAddFeed(result.url, result.title)}
                      >
                        <PlusCircle size={14} />
                        Add
                      </button>
                      <a
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm text-white/80"
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
          <div class="glass rounded-2xl p-12 text-center">
            <div
              class="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20"
            >
              <Search size={32} class="text-emerald-400" />
            </div>
            <h3 class="text-xl font-semibold text-white mb-2">
              Smart Feed Discovery
            </h3>
            <p class="text-white/60 mb-6">
              Search by keywords and we'll find feeds from multiple sources
            </p>
            <div class="max-w-md mx-auto text-left space-y-2">
              <p class="text-sm font-semibold text-white/60">Try searching for:</p>
              <ul class="text-sm text-white/60 space-y-1">
                <li>• <span class="text-white/80">"omgubuntu"</span> - Find tech blogs</li>
                <li>• <span class="text-white/80">"cooking podcasts"</span> - Discover food shows</li>
                <li>• <span class="text-white/80">"tech news youtube"</span> - YouTube channels</li>
                <li>• <span class="text-white/80">"r/technology"</span> - Reddit subreddits</li>
              </ul>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Scrollbar styling */
  :global(.overflow-y-auto::-webkit-scrollbar) {
    width: 8px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
