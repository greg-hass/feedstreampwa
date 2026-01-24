<script lang="ts">
  import { Activity, AlertTriangle, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, RefreshCw } from "lucide-svelte";
  import { onMount } from "svelte";
  import { feeds } from "$lib/stores/feeds";
  import { toast } from "$lib/stores/toast";
  import type { Feed } from "$lib/types";

  interface FeedHealth {
    feed: Feed;
    status: "healthy" | "warning" | "error";
    lastFetch: Date | null;
    hoursSinceUpdate: number;
    errorCount: number;
    successRate: number;
  }

  let feedHealth: FeedHealth[] = [];
  let loading = true;
  let filter: "all" | "healthy" | "warning" | "error" = "all";

  onMount(async () => {
    await analyzeFeedHealth();
  });

  async function analyzeFeedHealth() {
    loading = true;
    try {
      // Analyze each feed's health
      feedHealth = $feeds.map(feed => {
        const lastFetch = feed.last_fetched_at ? new Date(feed.last_fetched_at) : null;
        const now = new Date();
        const hoursSinceUpdate = lastFetch 
          ? (now.getTime() - lastFetch.getTime()) / (1000 * 60 * 60)
          : 999;

        // Determine health status
        let status: "healthy" | "warning" | "error" = "healthy";
        let errorCount = 0;
        let successRate = 100;

        if (!lastFetch) {
          status = "error";
          errorCount = 1;
          successRate = 0;
        } else if (hoursSinceUpdate > 48) {
          status = "error";
          errorCount = 1;
        } else if (hoursSinceUpdate > 24) {
          status = "warning";
        }

        return {
          feed,
          status,
          lastFetch,
          hoursSinceUpdate,
          errorCount,
          successRate
        };
      });

      // Sort by status (errors first, then warnings, then healthy)
      feedHealth.sort((a, b) => {
        const statusOrder = { error: 0, warning: 1, healthy: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
    } catch (error) {
      console.error("Failed to analyze feed health:", error);
      toast.error("Failed to analyze feed health");
    } finally {
      loading = false;
    }
  }

  function formatLastUpdate(date: Date | null): string {
    if (!date) return "Never";
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    const days = diff / (1000 * 60 * 60 * 24);

    if (hours < 1) return "Just now";
    if (hours < 24) return `${Math.floor(hours)}h ago`;
    if (days < 7) return `${Math.floor(days)}d ago`;
    return date.toLocaleDateString();
  }

  $: filteredFeeds = feedHealth.filter(fh => 
    filter === "all" || fh.status === filter
  );

  $: healthyCount = feedHealth.filter(f => f.status === "healthy").length;
  $: warningCount = feedHealth.filter(f => f.status === "warning").length;
  $: errorCount = feedHealth.filter(f => f.status === "error").length;
</script>

<div class="space-y-6">
  <!-- Overview Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <button
      class="bg-zinc-900 border rounded-xl p-4 text-left transition-all
        {filter === 'healthy' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-zinc-800 hover:border-zinc-700'}"
      on:click={() => filter = filter === "healthy" ? "all" : "healthy"}
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <CheckCircle2 size={20} class="text-emerald-400" />
          <span class="text-sm font-medium text-zinc-400">Healthy</span>
        </div>
        {#if filter === "healthy"}
          <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
        {/if}
      </div>
      <div class="text-3xl font-bold text-white">{healthyCount}</div>
      <div class="text-xs text-zinc-500 mt-1">Feeds working normally</div>
    </button>

    <button
      class="bg-zinc-900 border rounded-xl p-4 text-left transition-all
        {filter === 'warning' ? 'border-yellow-500 ring-2 ring-yellow-500/20' : 'border-zinc-800 hover:border-zinc-700'}"
      on:click={() => filter = filter === "warning" ? "all" : "warning"}
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <AlertTriangle size={20} class="text-yellow-400" />
          <span class="text-sm font-medium text-zinc-400">Warning</span>
        </div>
        {#if filter === "warning"}
          <div class="w-2 h-2 rounded-full bg-yellow-400"></div>
        {/if}
      </div>
      <div class="text-3xl font-bold text-white">{warningCount}</div>
      <div class="text-xs text-zinc-500 mt-1">Feeds need attention</div>
    </button>

    <button
      class="bg-zinc-900 border rounded-xl p-4 text-left transition-all
        {filter === 'error' ? 'border-red-500 ring-2 ring-red-500/20' : 'border-zinc-800 hover:border-zinc-700'}"
      on:click={() => filter = filter === "error" ? "all" : "error"}
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <XCircle size={20} class="text-red-400" />
          <span class="text-sm font-medium text-zinc-400">Error</span>
        </div>
        {#if filter === "error"}
          <div class="w-2 h-2 rounded-full bg-red-400"></div>
        {/if}
      </div>
      <div class="text-3xl font-bold text-white">{errorCount}</div>
      <div class="text-xs text-zinc-500 mt-1">Feeds not updating</div>
    </button>
  </div>

  <!-- Feed List -->
  <section class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
    <div class="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Activity size={20} class="text-zinc-500" />
        <h3 class="text-lg font-bold text-white">
          {filter === "all" ? "All Feeds" : filter === "healthy" ? "Healthy Feeds" : filter === "warning" ? "Feeds with Warnings" : "Feeds with Errors"}
        </h3>
        <span class="text-sm text-zinc-500">({filteredFeeds.length})</span>
      </div>
      <button
        class="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
        on:click={analyzeFeedHealth}
        disabled={loading}
      >
        <RefreshCw size={14} class={loading ? "animate-spin" : ""} />
        Refresh
      </button>
    </div>

    <div class="divide-y divide-zinc-800">
      {#if loading}
        <div class="p-12 text-center">
          <div class="inline-block animate-spin text-emerald-400 mb-3">
            <RefreshCw size={32} />
          </div>
          <p class="text-zinc-400 text-sm">Analyzing feed health...</p>
        </div>
      {:else if filteredFeeds.length === 0}
        <div class="p-12 text-center">
          <div class="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-4">
            <Activity size={32} class="text-zinc-600" />
          </div>
          <p class="text-zinc-400 text-sm">
            {filter === "all" ? "No feeds found" : `No ${filter} feeds found`}
          </p>
        </div>
      {:else}
        {#each filteredFeeds as { feed, status, lastFetch, hoursSinceUpdate } (feed.url)}
          <div class="p-4 hover:bg-zinc-800/50 transition-colors">
            <div class="flex items-start gap-4">
              <!-- Status Indicator -->
              <div class="flex-shrink-0 mt-1">
                {#if status === "healthy"}
                  <CheckCircle2 size={20} class="text-emerald-400" />
                {:else if status === "warning"}
                  <AlertTriangle size={20} class="text-yellow-400" />
                {:else}
                  <XCircle size={20} class="text-red-400" />
                {/if}
              </div>

              <!-- Feed Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-4 mb-2">
                  <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-white truncate">{feed.title || feed.url}</h4>
                    <p class="text-xs text-zinc-500 truncate mt-0.5">{feed.url}</p>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <div class="text-right">
                      <div class="text-xs text-zinc-400 flex items-center gap-1">
                        <Clock size={12} />
                        {formatLastUpdate(lastFetch)}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Status Details -->
                <div class="flex items-center gap-4 text-xs">
                  {#if status === "error"}
                    <span class="text-red-400 font-medium">
                      {!lastFetch ? "Never fetched" : `No updates for ${Math.floor(hoursSinceUpdate)}h`}
                    </span>
                  {:else if status === "warning"}
                    <span class="text-yellow-400 font-medium">
                      Last update {Math.floor(hoursSinceUpdate)}h ago
                    </span>
                  {:else}
                    <span class="text-emerald-400 font-medium">
                      Working normally
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        {/each}
      {/if}
    </div>
  </section>

  <!-- Health Tips -->
  {#if errorCount > 0 || warningCount > 0}
    <section class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      <div class="px-6 py-4 border-b border-zinc-800">
        <h3 class="text-lg font-bold text-white flex items-center gap-2">
          <AlertTriangle size={20} class="text-yellow-400" />
          Recommendations
        </h3>
      </div>
      <div class="p-6 space-y-3">
        {#if errorCount > 0}
          <div class="flex gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <XCircle size={18} class="text-red-400 flex-shrink-0 mt-0.5" />
            <div class="text-sm">
              <p class="font-medium text-red-200 mb-1">Feeds Not Updating</p>
              <p class="text-red-300/70 text-xs">
                {errorCount} feed{errorCount > 1 ? "s are" : " is"} not updating. Check if the feed URL is still valid or if the source has been discontinued.
              </p>
            </div>
          </div>
        {/if}
        {#if warningCount > 0}
          <div class="flex gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <AlertTriangle size={18} class="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div class="text-sm">
              <p class="font-medium text-yellow-200 mb-1">Infrequent Updates</p>
              <p class="text-yellow-300/70 text-xs">
                {warningCount} feed{warningCount > 1 ? "s have" : " has"} not updated in over 24 hours. This might be normal for some feeds, but verify they're still active.
              </p>
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}
</div>
