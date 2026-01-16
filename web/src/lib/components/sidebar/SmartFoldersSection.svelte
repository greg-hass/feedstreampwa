<script lang="ts">
  import {
    Rss,
    Youtube,
    Hash,
    Mic,
  } from "lucide-svelte";
  import {
    viewMode,
    activeSmartFolder,
    setViewSmartFolder,
  } from "$lib/stores/ui";
  import {
    rssCount,
    youtubeCount,
    redditCount,
    podcastCount,
    formatUnreadTotal,
  } from "$lib/stores/counts";
</script>

<div class="space-y-1 mt-6">
  <div
    class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-200 uppercase tracking-[0.22em] mb-3"
  >
    <span class="h-1.5 w-1.5 rounded-full bg-emerald-300/80"></span>
    Smart Folders
  </div>

  <!-- RSS -->
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
      {$viewMode === 'smart' && $activeSmartFolder === 'rss'
      ? 'bg-white/10 text-white shadow-inner border border-white/5'
      : 'text-white/60 hover:text-white hover:bg-white/5'}"
    on:click={() => setViewSmartFolder("rss")}
  >
    <div class="flex items-center gap-3">
      <Rss
        size={24}
        class={$viewMode === "smart" && $activeSmartFolder === "rss"
          ? "text-emerald-400"
          : "text-emerald-400/70 group-hover:text-emerald-400"}
      />
      RSS
    </div>

    {#if $rssCount.total > 0}
      <span
        class="text-xs font-medium {$viewMode === 'smart' &&
        $activeSmartFolder === 'rss'
          ? 'text-white/70'
          : 'text-white/40'}"
      >
        {formatUnreadTotal($rssCount.unread, $rssCount.total)}
      </span>
    {/if}
  </button>

  <!-- YouTube -->
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
      {$viewMode === 'smart' && $activeSmartFolder === 'youtube'
      ? 'bg-white/10 text-white shadow-inner border border-white/5'
      : 'text-white/60 hover:text-white hover:bg-white/5'}"
    on:click={() => setViewSmartFolder("youtube")}
  >
    <div class="flex items-center gap-3">
      <Youtube
        size={24}
        class={$viewMode === "smart" && $activeSmartFolder === "youtube"
          ? "text-red-500"
          : "text-red-500/70 group-hover:text-red-500"}
      />
      YouTube
    </div>

    {#if $youtubeCount.total > 0}
      <span
        class="text-xs font-medium {$viewMode === 'smart' &&
        $activeSmartFolder === 'youtube'
          ? 'text-white/70'
          : 'text-white/40'}"
      >
        {formatUnreadTotal($youtubeCount.unread, $youtubeCount.total)}
      </span>
    {/if}
  </button>

  <!-- Reddit -->
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
      {$viewMode === 'smart' && $activeSmartFolder === 'reddit'
      ? 'bg-white/10 text-white shadow-inner border border-white/5'
      : 'text-white/60 hover:text-white hover:bg-white/5'}"
    on:click={() => setViewSmartFolder("reddit")}
  >
    <div class="flex items-center gap-3">
      <Hash
        size={24}
        class={$viewMode === "smart" && $activeSmartFolder === "reddit"
          ? "text-orange-400"
          : "text-orange-400/70 group-hover:text-orange-400"}
      />
      Reddit
    </div>

    {#if $redditCount.total > 0}
      <span
        class="text-xs font-medium {$viewMode === 'smart' &&
        $activeSmartFolder === 'reddit'
          ? 'text-white/70'
          : 'text-white/40'}"
      >
        {formatUnreadTotal($redditCount.unread, $redditCount.total)}
      </span>
    {/if}
  </button>

  <!-- Podcasts -->
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
      {$viewMode === 'smart' && $activeSmartFolder === 'podcast'
      ? 'bg-white/10 text-white shadow-inner border border-white/5'
      : 'text-white/60 hover:text-white hover:bg-white/5'}"
    on:click={() => setViewSmartFolder("podcast")}
  >
    <div class="flex items-center gap-3">
      <Mic
        size={24}
        class={$viewMode === "smart" && $activeSmartFolder === "podcast"
          ? "text-indigo-400"
          : "text-indigo-400/70 group-hover:text-indigo-400"}
      />
      Podcasts
    </div>

    {#if $podcastCount.total > 0}
      <span
        class="text-xs font-medium {$viewMode === 'smart' &&
        $activeSmartFolder === 'podcast'
          ? 'text-white/70'
          : 'text-white/40'}"
      >
        {formatUnreadTotal($podcastCount.unread, $podcastCount.total)}
      </span>
    {/if}
  </button>
</div>
