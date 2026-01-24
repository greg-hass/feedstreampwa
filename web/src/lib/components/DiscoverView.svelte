<script lang="ts">
  import {
    Sparkles,
    TrendingUp,
    Loader2,
    Plus,
    ExternalLink,
  } from "lucide-svelte";
  import {
    getFeedRecommendations,
    getFeedRecommendationsDebug,
    createFeed,
    type FeedRecommendation,
    type FeedRecommendationsDebug,
  } from "$lib/api/feeds";
  import { toast } from "$lib/stores/toast";
  import { loadFeeds } from "$lib/stores/feeds";
  import { onMount } from "svelte";

  let recommendations: FeedRecommendation[] = [];
  let loading = false;
  let error: string | null = null;
  let addingFeeds = new Set<string>();
  let showDebug = false;
  let debugInfo: FeedRecommendationsDebug | null = null;
  let debugLoading = false;
  let debugError: string | null = null;

  async function loadRecommendations() {
    loading = true;
    error = null;

    try {
      recommendations = await getFeedRecommendations(8);
      if (recommendations.length === 0) {
        error =
          "No recommendations available yet. Try reading more articles to help the AI understand your interests!";
      }
    } catch (err: unknown) {
      console.error("Failed to load recommendations:", err);
      error = err instanceof Error ? err.message : "Failed to load recommendations";
    } finally {
      loading = false;
    }
  }

  async function addFeed(rec: FeedRecommendation) {
    addingFeeds.add(rec.url);
    addingFeeds = addingFeeds;

    try {
      await createFeed(rec.url);
      await loadFeeds();
      toast.success(`Added ${rec.title}!`);

      // Remove from recommendations
      recommendations = recommendations.filter((r) => r.url !== rec.url);
    } catch (err: unknown) {
      console.error("Failed to add feed:", err);
      toast.error(err instanceof Error ? err.message : "Failed to add feed");
    } finally {
      addingFeeds.delete(rec.url);
      addingFeeds = addingFeeds;
    }
  }

  async function loadDebugInfo() {
    debugLoading = true;
    debugError = null;
    try {
      const data = await getFeedRecommendationsDebug(8);
      debugInfo = data.debug;
      if (!debugInfo) {
        debugError = "No debug data returned.";
      }
    } catch (err: unknown) {
      debugError = err instanceof Error ? err.message : "Failed to load debug data";
    } finally {
      debugLoading = false;
    }
  }

  function toggleDebug() {
    showDebug = !showDebug;
    if (showDebug && !debugInfo && !debugLoading) {
      loadDebugInfo();
    }
  }

  async function copyToClipboard(text: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
      return;
    } catch (err) {
      // Fallback
    }
    toast.error("Failed to copy");
  }

  const categoryColor: Record<string, string> = {
    technology: "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
    news: "from-red-500/20 to-orange-500/20 border-red-500/30",
    entertainment: "from-purple-500/20 to-pink-500/20 border-purple-500/30",
    science: "from-green-500/20 to-emerald-500/20 border-green-500/30",
    business: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30",
    lifestyle: "from-pink-500/20 to-rose-500/20 border-pink-500/30",
    sports: "from-orange-500/20 to-red-500/20 border-orange-500/30",
    other: "from-gray-500/20 to-slate-500/20 border-gray-500/30",
  };

  onMount(() => {
    loadRecommendations();
  });
</script>

<div class="pb-20">
  <!-- Header -->
  <div class="mb-8">
    <div class="flex items-center gap-3 mb-2">
      <div
        class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20"
      >
        <Sparkles size={20} class="text-white" />
      </div>
      <h2 class="text-2xl font-bold text-white">Discover</h2>
    </div>
    <p class="text-zinc-400">
      AI-powered feed recommendations based on your reading habits.
    </p>
  </div>

  <!-- Content -->
  {#if showDebug}
    <div
      class="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-400"
    >
      <!-- Debug Info (simplified for view) -->
      {#if debugLoading}
        <div class="flex items-center gap-2">
          <Loader2 size={14} class="animate-spin" />
          Loading debug data...
        </div>
      {:else if debugInfo}
        <div class="grid grid-cols-2 gap-4">
          <div>Feeds: {debugInfo.feedCount}</div>
          <div>Read: {debugInfo.readCount}</div>
          <div class="col-span-2">Model: {debugInfo.model}</div>
        </div>
      {/if}
    </div>
  {/if}

  {#if loading}
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <Loader2 size={40} class="text-emerald-500 animate-spin mb-4" />
      <p class="text-zinc-300 font-medium">Curating your personalized feed...</p>
      <p class="text-zinc-500 text-sm mt-1">Analyzing reading patterns</p>
    </div>
  {:else if error}
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <p class="text-red-400 mb-2">{error}</p>
      <button
        class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
        on:click={loadRecommendations}
      >
        Try Again
      </button>
    </div>
  {:else if recommendations.length === 0}
    <div class="text-center py-20 text-zinc-500">
      No recommendations found right now.
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {#each recommendations as rec (rec.url)}
        <div
          class="group relative flex flex-col bg-zinc-900 border border-zinc-800/50 rounded-2xl p-5 hover:border-zinc-700 transition-all hover:bg-zinc-800/50"
        >
          <!-- Header -->
          <div class="flex items-start justify-between mb-3">
            <span
              class="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-950 px-2 py-1 rounded-md"
            >
              {rec.category}
            </span>
            <div class="flex items-center gap-1 text-xs text-emerald-400 font-medium">
              <TrendingUp size={12} />
              {Math.round(rec.confidence * 100)}% match
            </div>
          </div>

          <!-- Content -->
          <h3 class="text-base font-bold text-white mb-2 line-clamp-2">
            {rec.title}
          </h3>
          <p class="text-sm text-zinc-400 mb-4 line-clamp-3 leading-relaxed">
            {rec.description}
          </p>

          <!-- Reason Badge -->
          <div class="mt-auto mb-4">
            <div class="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5">
              <div class="flex gap-2">
                <Sparkles size={12} class="text-emerald-500 mt-0.5 flex-shrink-0" />
                <p class="text-xs text-emerald-200/80 italic leading-relaxed">
                  "{rec.reason}"
                </p>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-2 pt-2 border-t border-zinc-800">
            <button
              class="flex-1 h-9 rounded-lg bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 font-semibold text-xs disabled:opacity-50"
              on:click={() => addFeed(rec)}
              disabled={addingFeeds.has(rec.url)}
            >
              {#if addingFeeds.has(rec.url)}
                <Loader2 size={14} class="animate-spin" />
                Adding...
              {:else}
                <Plus size={14} />
                Add Feed
              {/if}
            </button>
            <a
              href={rec.url}
              target="_blank"
              rel="noopener noreferrer"
              class="h-9 w-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
              title="Preview"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
