<script lang="ts">
  import { onMount } from "svelte";
  import {
    Rss,
    Trash2,
    RefreshCw,
    FolderPlus,
    Plus,
    Settings,
    ExternalLink,
  } from "lucide-svelte";
  import { isAddFeedModalOpen } from "$lib/stores/ui";
  import type { Feed } from "$lib/types";

  let feeds: Feed[] = [];
  let loading = false;
  let error: string | null = null;

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

  async function deleteFeed(url: string) {
    if (!confirm("Are you sure you want to unsubscribe from this feed?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/feeds?url=${encodeURIComponent(url)}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete feed");
      }

      await loadFeeds();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete feed");
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

      alert("Feed refresh started!");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to refresh feed");
    }
  }

  function getSourceIcon(type: string) {
    switch (type) {
      case "youtube":
        return "text-red-500";
      case "reddit":
        return "text-orange-500";
      case "podcast":
        return "text-purple-500";
      default:
        return "text-emerald-500";
    }
  }
</script>

<svelte:head>
  <title>My Feeds - FeedStream</title>
</svelte:head>

<div class="max-w-5xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-3xl font-bold text-white mb-2">My Feeds</h1>
      <p class="text-white/60">
        Manage your subscriptions ({feeds.length} feed{feeds.length !== 1
          ? "s"
          : ""})
      </p>
    </div>
    <button
      class="flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
      on:click={() => isAddFeedModalOpen.set(true)}
    >
      <Plus size={18} />
      Add Feed
    </button>
  </div>

  <!-- Loading State -->
  {#if loading}
    <div class="flex items-center justify-center py-20">
      <div class="text-white/60">Loading feeds...</div>
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
  {:else}
    <!-- Feeds List -->
    <div class="space-y-4">
      {#each feeds as feed (feed.url)}
        <div
          class="glass rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-all hover:-translate-y-0.5"
        >
          <div class="flex items-start gap-4">
            <!-- Feed Icon -->
            <div
              class="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex-shrink-0 overflow-hidden"
            >
              {#if feed.icon_url}
                <img
                  src={feed.icon_url}
                  alt={feed.title}
                  class="w-full h-full object-cover"
                />
              {:else}
                <div
                  class="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0"
                >
                  <Rss size={24} class={getSourceIcon(feed.type)} />
                </div>
              {/if}
            </div>

            <!-- Feed Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-4 mb-2">
                <div class="flex-1 min-w-0">
                  <h3 class="text-lg font-semibold text-white truncate">
                    {feed.title}
                  </h3>
                  <p class="text-sm text-white/60 truncate">
                    {feed.url}
                  </p>
                </div>

                <!-- Unread Badge -->
                {#if feed.unreadCount && feed.unreadCount > 0}
                  <div
                    class="px-3 py-1 bg-accent/20 text-accent rounded-full text-sm font-medium"
                  >
                    {feed.unreadCount} unread
                  </div>
                {/if}
              </div>

              {#if feed.description}
                <p class="text-sm text-white/40 line-clamp-2 mb-4">
                  {feed.description}
                </p>
              {/if}

              <!-- Actions -->
              <div class="flex items-center gap-2 flex-wrap">
                <button
                  class="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm text-white/80"
                  on:click={() => refreshFeed(feed.url)}
                >
                  <RefreshCw size={14} />
                  Refresh
                </button>

                <a
                  href={feed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm text-white/80"
                  on:click|stopPropagation
                >
                  <ExternalLink size={14} />
                  Visit
                </a>

                <button
                  class="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm ml-auto"
                  on:click={() => deleteFeed(feed.url)}
                >
                  <Trash2 size={14} />
                  Unsubscribe
                </button>
              </div>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
