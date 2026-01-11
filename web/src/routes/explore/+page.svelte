<script lang="ts">
  import { Search, Compass, Plus, Rss, Youtube, Hash, Radio, ExternalLink } from "lucide-svelte";
  import type { SearchResult } from "$lib/types";

  let searchQuery = "";
  let searchResults: SearchResult[] = [];
  let searching = false;
  let error: string | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function searchFeeds() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    searching = true;
    error = null;

    try {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        type: "all",
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
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      searchFeeds();
    }, 500);
  }

  async function subscribeFeed(url: string) {
    try {
      const response = await fetch("/api/feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to subscribe");
      }

      alert("Subscribed successfully!");
      // Optionally reload the search to update subscription status
      await searchFeeds();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to subscribe");
    }
  }

  function getSourceIcon(type: string) {
    switch (type) {
      case "youtube":
        return { icon: Youtube, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" };
      case "reddit":
        return { icon: Hash, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20" };
      case "podcast":
        return { icon: Radio, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" };
      default:
        return { icon: Rss, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    }
  }
</script>

<svelte:head>
  <title>Explore - FeedStream</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
  <!-- Header -->
  <div class="mb-8">
    <div class="flex items-center gap-3 mb-2">
      <div
        class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center"
      >
        <Compass size={24} class="text-blue-400" />
      </div>
      <div>
        <h1 class="text-3xl font-bold text-white">Explore</h1>
      </div>
    </div>
    <p class="text-white/60">
      Discover new RSS feeds, podcasts, and YouTube channels
    </p>
  </div>

  <!-- Search Bar -->
  <div class="relative mb-8">
    <div
      class="relative glass rounded-2xl border border-white/10 focus-within:border-accent/50 transition-colors"
    >
      <div class="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
        <Search size={20} />
      </div>
      <input
        type="text"
        placeholder="Search for feeds, podcasts, or YouTube channels..."
        bind:value={searchQuery}
        on:input={handleSearchInput}
        class="w-full bg-transparent pl-12 pr-4 py-4 text-white placeholder-white/40 outline-none"
      />
      {#if searching}
        <div
          class="absolute right-4 top-1/2 -translate-y-1/2 text-white/40"
        >
          <div class="animate-spin">
            <Search size={18} />
          </div>
        </div>
      {/if}
    </div>
  </div>

  <!-- Results -->
  {#if error}
    <div
      class="glass rounded-2xl p-8 text-center border border-red-500/20 bg-red-500/5"
    >
      <p class="text-red-400">{error}</p>
    </div>
  {:else if searchQuery && !searching && searchResults.length === 0}
    <div class="glass rounded-2xl p-12 text-center">
      <div
        class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4"
      >
        <Search size={32} class="text-white/40" />
      </div>
      <h2 class="text-xl font-semibold text-white mb-2">No results found</h2>
      <p class="text-white/60">Try searching for a different term or URL</p>
    </div>
  {:else if searchResults.length > 0}
    <div class="space-y-4">
      {#each searchResults as result}
        {@const sourceStyle = getSourceIcon(result.type)}
        <div
          class="glass rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all hover:-translate-y-0.5"
        >
          <div class="flex items-start gap-4">
            <!-- Thumbnail/Icon -->
            <div
              class="w-14 h-14 rounded-xl {sourceStyle.bg} border {sourceStyle.border} flex-shrink-0 overflow-hidden"
            >
              {#if result.thumbnail}
                <img
                  src={result.thumbnail}
                  alt={result.title}
                  class="w-full h-full object-cover"
                />
              {:else}
                <div
                  class="w-full h-full flex items-center justify-center"
                >
                  <svelte:component this={sourceStyle.icon} size={24} class={sourceStyle.color} />
                </div>
              {/if}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-4 mb-2">
                <div class="flex-1 min-w-0">
                  <h3 class="text-lg font-semibold text-white truncate">
                    {result.title}
                  </h3>
                  <p class="text-sm text-white/60 truncate">
                    {result.url}
                  </p>
                </div>

                <!-- Type Badge -->
                <div
                  class="{sourceStyle.bg} {sourceStyle.border} px-3 py-1 rounded-full text-sm font-medium {sourceStyle.color} uppercase border"
                >
                  {result.type}
                </div>
              </div>

              {#if result.description}
                <p class="text-sm text-white/40 line-clamp-2 mb-4">
                  {result.description}
                </p>
              {/if}

              <!-- Actions -->
              <div class="flex items-center gap-2">
                <button
                  class="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm shadow-lg shadow-accent/20"
                  on:click={() => subscribeFeed(result.url)}
                >
                  <Plus size={14} />
                  Subscribe
                </button>

                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm text-white/80"
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
    <!-- Empty/Initial State -->
    <div class="glass rounded-2xl p-12 text-center">
      <div
        class="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20"
      >
        <Compass size={32} class="text-blue-400" />
      </div>
      <h2 class="text-xl font-semibold text-white mb-2">
        Start exploring
      </h2>
      <p class="text-white/60 mb-6">
        Search for topics, creators, or paste a feed URL to discover new content
      </p>
      <div class="flex flex-col gap-2 max-w-md mx-auto text-left">
        <p class="text-sm text-white/40">Try searching for:</p>
        <ul class="text-sm text-white/60 space-y-1">
          <li>• "Technology podcasts"</li>
          <li>• "Cooking YouTube channels"</li>
          <li>• "News subreddits"</li>
          <li>• Any RSS feed URL</li>
        </ul>
      </div>
    </div>
  {/if}
</div>
