<script lang="ts">
  import {
    LayoutDashboard,
    Eye,
    Bookmark,
    Sparkles
  } from "lucide-svelte";
  import {
    viewMode,
    setViewAll,
    setViewUnread,
    setViewBookmarks,
    setViewDiscover
  } from "$lib/stores/ui";
  import {
    allArticlesUnread,
    allArticlesTotal,
    libraryTotal,
    formatUnreadTotal,
  } from "$lib/stores/counts";
</script>

<div class="space-y-1">
  <div
    class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-semibold text-white/70 uppercase tracking-[0.22em] mb-3 mt-2"
  >
    <span class="h-1.5 w-1.5 rounded-full bg-white/70"></span>
    Menu
  </div>

  <!-- All Articles Button -->
  <button
    on:click={() => setViewAll()}
    class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
    {$viewMode === 'all'
      ? 'bg-white/10 text-white shadow-inner border border-white/5'
      : 'text-white/60 hover:text-white hover:bg-white/5'}"
  >
    <div class="flex items-center gap-3">
      <div class="w-6 flex items-center justify-center">
        <LayoutDashboard
          size={24}
          class="text-emerald-400"
        />
      </div>
      All Articles
    </div>

    {#if $allArticlesTotal > 0}
      <span
        class="text-xs font-medium {$viewMode === 'all'
          ? 'text-white/70'
          : 'text-white/40'}"
      >
        {formatUnreadTotal($allArticlesUnread, $allArticlesTotal)}
      </span>
    {/if}
  </button>

  <!-- Discover Button -->
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
      {$viewMode === 'discover'
      ? 'bg-white/10 text-white shadow-inner border border-white/5'
      : 'text-white/60 hover:text-white hover:bg-white/5'}"
    on:click={setViewDiscover}
  >
    <div class="flex items-center gap-3">
      <div class="w-6 flex items-center justify-center">
        <Sparkles
          size={24}
          class="text-emerald-400"
        />
      </div>
      Discover
    </div>
  </button>

  <!-- Bookmarks -->
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
      {$viewMode === 'bookmarks'
      ? 'bg-white/10 text-white shadow-inner border border-white/5'
      : 'text-white/60 hover:text-white hover:bg-white/5'}"
    on:click={setViewBookmarks}
  >
    <div class="flex items-center gap-3">
      <div class="w-6 flex items-center justify-center">
        <Bookmark
          size={24}
          class="text-emerald-400"
          fill={$viewMode === "bookmarks" ? "currentColor" : "none"}
        />
      </div>
      Bookmarks
    </div>

    {#if $libraryTotal > 0}
      <span
        class="text-xs font-medium {$viewMode === 'bookmarks'
          ? 'text-white/70'
          : 'text-white/40'}"
      >
        {$libraryTotal}
      </span>
    {/if}
  </button>
</div>
