<script lang="ts">
  import { onMount } from "svelte";
  import { Star, Bookmark } from "lucide-svelte";
  import FeedGrid from "$lib/components/FeedGrid.svelte";
  import { playMedia } from "$lib/stores/media";
  import type { Item } from "$lib/types";
  import { toggleRead, toggleStar } from "$lib/stores/items";

  let items: Item[] = [];
  let loading = false;
  let error: string | null = null;

  onMount(() => {
    loadStarredItems();
  });

  async function loadStarredItems() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams({
        starredOnly: "1",
        limit: "200",
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
    window.open(item.url, "_blank");
  }
</script>

<svelte:head>
  <title>Library - FeedStream</title>
</svelte:head>

<div class="max-w-7xl mx-auto">
  <!-- Header -->
  <div class="mb-8">
    <div class="flex items-center gap-3 mb-2">
      <div
        class="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/20 flex items-center justify-center"
      >
        <Bookmark size={24} class="text-yellow-400" />
      </div>
      <div>
        <h1 class="text-3xl font-bold text-white">Library</h1>
      </div>
    </div>
    <p class="text-white/60">
      Your saved and starred articles ({items.length} item{items.length !== 1
        ? "s"
        : ""})
    </p>
  </div>

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
  {:else}
    <!-- Starred Items Grid -->
    <FeedGrid
      {items}
      on:open={(e) => handleArticleClick(e.detail.item)}
      on:toggleStar={(e) => handleToggleStar(e.detail.item)}
      on:toggleRead={(e) => handleToggleRead(e.detail.item)}
      on:play={(e) => playMedia(e.detail.item)}
    />
  {/if}
</div>
