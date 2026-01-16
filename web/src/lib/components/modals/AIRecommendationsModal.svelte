<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import {
    X,
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

  export let isOpen = false;

  const dispatch = createEventDispatcher();

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
    } catch (err: any) {
      console.error("Failed to load recommendations:", err);
      error = err.message || "Failed to load recommendations";
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
    } catch (err: any) {
      console.error("Failed to add feed:", err);
      toast.error(err.message || "Failed to add feed");
    } finally {
      addingFeeds.delete(rec.url);
      addingFeeds = addingFeeds;
    }
  }

  function close() {
    dispatch("close");
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
    } catch (err: any) {
      debugError = err.message || "Failed to load debug data";
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

  async function copyPrompt() {
    const text = debugInfo?.promptPreview;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prompt copied");
    } catch (err) {
      toast.error("Failed to copy prompt");
    }
  }

  async function copyError() {
    const text = debugInfo?.lastError;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Error copied");
    } catch (err) {
      toast.error("Failed to copy error");
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.currentTarget === event.target) {
      close();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    }
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

  $: if (isOpen) {
    loadRecommendations();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <div
    class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
    on:click={handleBackdropClick}
    on:keydown={handleBackdropKeydown}
    role="button"
    aria-label="Close dialog"
    tabindex="0"
  >
    <div
      class="bg-[#18181b] rounded-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-t-2xl border-b border-white/10 px-6 py-5 flex items-center justify-between flex-shrink-0"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center"
          >
            <Sparkles size={24} class="text-white" />
          </div>
          <div>
            <h2 class="text-2xl font-bold text-white">
              AI Feed Recommendations
            </h2>
            <p class="text-sm text-white/60">
              Personalized suggestions based on your reading habits
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs font-semibold text-white/70 hover:text-white hover:border-white/20 transition-colors"
            on:click={toggleDebug}
          >
            {showDebug ? "Hide Debug" : "Debug"}
          </button>
          <button
            class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            on:click={close}
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="flex-1 overflow-y-auto p-6">
        {#if showDebug}
          <div
            class="mb-6 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white/70"
          >
            {#if debugLoading}
              <div class="flex items-center gap-2 text-white/60">
                <Loader2 size={14} class="animate-spin" />
                Loading debug data...
              </div>
            {:else if debugError}
              <div class="text-red-400">{debugError}</div>
            {:else if debugInfo}
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <span class="text-white/40">Gemini Key</span>
                  <div class="text-white/80">
                    {debugInfo.hasGeminiKey ? "Configured" : "Missing"}
                  </div>
                </div>
                <div>
                  <span class="text-white/40">Model</span>
                  <div class="text-white/80">{debugInfo.model || "—"}</div>
                </div>
                <div>
                  <span class="text-white/40">Feeds</span>
                  <div class="text-white/80">{debugInfo.feedCount}</div>
                </div>
                <div>
                  <span class="text-white/40">Read Articles</span>
                  <div class="text-white/80">{debugInfo.readCount}</div>
                </div>
                <div>
                  <span class="text-white/40">Starred Articles</span>
                  <div class="text-white/80">{debugInfo.starredCount}</div>
                </div>
                <div>
                  <span class="text-white/40">History Entries</span>
                  <div class="text-white/80">{debugInfo.historyCount}</div>
                </div>
                <div>
                  <span class="text-white/40">Last Interaction</span>
                  <div class="text-white/80">
                    {debugInfo.lastInteractionAt || "—"}
                  </div>
                </div>
                <div class="col-span-2">
                  <span class="text-white/40">Feeds by type</span>
                  <div class="text-white/80">
                    RSS {debugInfo.feedsByKind.generic || 0} • YouTube {debugInfo.feedsByKind.youtube || 0} •
                    Reddit {debugInfo.feedsByKind.reddit || 0} • Podcasts {debugInfo.feedsByKind.podcast || 0}
                  </div>
                </div>
                <div class="col-span-2">
                  <div class="flex items-center justify-between">
                    <span class="text-white/40">Last Error</span>
                    <button
                      class="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
                      on:click={copyError}
                      disabled={!debugInfo.lastError}
                    >
                      Copy Error
                    </button>
                  </div>
                  <div class="text-white/80">{debugInfo.lastError || "—"}</div>
                </div>
                <div class="col-span-2">
                  <div class="flex items-center justify-between">
                    <span class="text-white/40">Prompt Preview</span>
                    <button
                      class="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
                      on:click={copyPrompt}
                      disabled={!debugInfo.promptPreview}
                    >
                      Copy Prompt
                    </button>
                  </div>
                  <pre
                    class="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] text-white/70"
                  >{debugInfo.promptPreview || "—"}</pre>
                </div>
              </div>
            {:else}
              <div class="text-white/50">No debug data.</div>
            {/if}
          </div>
        {/if}
        {#if loading}
          <div class="flex flex-col items-center justify-center py-20">
            <Loader2 size={48} class="text-purple-500 animate-spin mb-4" />
            <p class="text-white/60 text-lg">
              Analyzing your reading patterns...
            </p>
            <p class="text-white/40 text-sm mt-2">This may take a moment</p>
          </div>
        {:else if error}
          <div class="flex flex-col items-center justify-center py-20">
            <div
              class="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4"
            >
              <X size={32} class="text-red-400" />
            </div>
            <p class="text-red-400 text-lg mb-2">Oops!</p>
            <p class="text-white/60 text-center max-w-md">{error}</p>
            <button
              class="mt-6 px-6 py-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition-colors"
              on:click={loadRecommendations}
            >
              Try Again
            </button>
          </div>
        {:else if recommendations.length === 0}
          <div class="flex flex-col items-center justify-center py-20">
            <Sparkles size={48} class="text-white/20 mb-4" />
            <p class="text-white/60 text-lg">No recommendations yet</p>
            <p class="text-white/40 text-sm mt-2 max-w-md text-center">
              Read and star more articles to help the AI understand your
              interests!
            </p>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each recommendations as rec (rec.url)}
              <div
                class="group bg-gradient-to-br {categoryColor[rec.category] ||
                  categoryColor.other} rounded-xl border p-5 hover:scale-[1.02] transition-all duration-200"
              >
                <!-- Category Badge -->
                <div class="flex items-center justify-between mb-3">
                  <span
                    class="text-xs font-bold uppercase tracking-wider text-white/60"
                  >
                    {rec.category}
                  </span>
                  <div class="flex items-center gap-1 text-xs text-white/40">
                    <TrendingUp size={12} />
                    {Math.round(rec.confidence * 100)}% match
                  </div>
                </div>

                <!-- Title -->
                <h3 class="text-lg font-bold text-white mb-2 line-clamp-2">
                  {rec.title}
                </h3>

                <!-- Description -->
                <p class="text-sm text-white/60 mb-3 line-clamp-2">
                  {rec.description}
                </p>

                <!-- Reason -->
                <div class="bg-black/20 rounded-lg p-3 mb-4">
                  <p class="text-xs text-white/70 italic line-clamp-3">
                    "{rec.reason}"
                  </p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2">
                  <button
                    class="flex-1 px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    on:click={() => addFeed(rec)}
                    disabled={addingFeeds.has(rec.url)}
                  >
                    {#if addingFeeds.has(rec.url)}
                      <Loader2 size={16} class="animate-spin" />
                      Adding...
                    {:else}
                      <Plus size={16} />
                      Add Feed
                    {/if}
                  </button>
                  <a
                    href={rec.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                    title="Open feed URL"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      {#if !loading && !error && recommendations.length > 0}
        <div
          class="border-t border-white/10 px-6 py-4 flex items-center justify-between bg-[#18181b]"
        >
          <p class="text-sm text-white/40">Powered by Gemini 2.0 Flash</p>
          <button
            class="px-4 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm"
            on:click={loadRecommendations}
          >
            Refresh Recommendations
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
