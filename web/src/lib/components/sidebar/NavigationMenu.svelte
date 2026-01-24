<script lang="ts">
  import { LayoutDashboard, Eye, Bookmark, Sparkles } from "lucide-svelte";
  import {
    viewMode,
    setViewAll,
    setViewUnread,
    setViewBookmarks,
    setViewDiscover,
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
    class="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-2"
  >
    Menu
  </div>

  <!-- All Articles Button -->
  <button
    on:click={() => setViewAll()}
    class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
    {$viewMode === 'all'
      ? 'bg-[#1c1c1e] text-white border border-[#2c2c2e]'
      : 'text-[#8e8e93] hover:text-white hover:bg-[#161617]'}"
  >
    <div class="flex items-center gap-3">
      <LayoutDashboard size={24} class="text-emerald-400" />
      All Articles
    </div>

    {#if $allArticlesUnread > 0}
      <span
        class="text-xs font-medium {$viewMode === 'all'
          ? 'text-white/70'
          : 'text-[#8e8e93]'}"
      >
        {formatUnreadTotal($allArticlesUnread, $allArticlesTotal)}
      </span>
    {/if}
  </button>

  <!-- Discover Button -->
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
      {$viewMode === 'discover'
      ? 'bg-[#1c1c1e] text-white border border-[#2c2c2e]'
      : 'text-[#8e8e93] hover:text-white hover:bg-[#161617]'}"
    on:click={setViewDiscover}
  >
    <div class="flex items-center gap-3">
      <Sparkles size={24} class="text-emerald-400" />
      Discover
    </div>
  </button>

  <!-- Bookmarks -->
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
      {$viewMode === 'bookmarks'
      ? 'bg-[#1c1c1e] text-white border border-[#2c2c2e]'
      : 'text-[#8e8e93] hover:text-white hover:bg-[#161617]'}"
    on:click={setViewBookmarks}
  >
    <div class="flex items-center gap-3">
      <Bookmark
        size={24}
        class="text-emerald-400"
        fill={$viewMode === "bookmarks" ? "currentColor" : "none"}
      />
      Bookmarks
    </div>

    {#if $libraryTotal > 0}
      <span
        class="text-xs font-medium {$viewMode === 'bookmarks'
          ? 'text-white/70'
          : 'text-[#8e8e93]'}"
      >
        {$libraryTotal}
      </span>
    {/if}
  </button>
</div>
