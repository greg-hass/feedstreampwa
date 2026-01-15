<script lang="ts">
  import {
    LayoutDashboard,
    Eye,
    Bookmark,
  } from "lucide-svelte";
  import {
    viewMode,
    setViewAll,
    setViewUnread,
    setViewBookmarks,
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
    class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
    {$viewMode === 'all'
      ? 'bg-white/10 text-white shadow-inner border border-white/5'
      : 'text-white/60 hover:text-white hover:bg-white/5'}"
  >
    <div class="flex items-center gap-3">
      <div class="w-6 flex items-center justify-center">
        <LayoutDashboard
          size={24}
          class={$viewMode === 'all'
            ? "text-accent"
            : "text-current group-hover:text-white"}
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

  <!-- Unread -->
  <button
    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
      {$viewMode === 'unread'
      ? 'bg-white/10 text-white shadow-inner border border-white/5'
      : 'text-white/60 hover:text-white hover:bg-white/5'}"
    on:click={setViewUnread}
  >
    <div class="flex items-center gap-3">
      <div class="w-6 flex items-center justify-center">
        <Eye
          size={24}
          class={$viewMode === "unread"
            ? "text-blue-400"
            : "text-current group-hover:text-white"}
        />
      </div>
      Unread
    </div>

    {#if $allArticlesUnread > 0}
      <span
        class="text-xs font-medium {$viewMode === 'unread'
          ? 'text-white/70'
          : 'text-white/40'}"
      >
        {$allArticlesUnread}
      </span>
    {/if}
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
          class={$viewMode === "bookmarks"
            ? "text-[#FF9500]"
            : "text-current group-hover:text-white"}
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
