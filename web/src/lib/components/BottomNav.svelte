<script lang="ts">
  import { LayoutDashboard, List, Bookmark, Menu, Eye } from "lucide-svelte";
  import {
    isMobileMenuOpen,
    setViewAll,
    setViewBookmarks,
    setViewUnread,
    viewMode,
  } from "$lib/stores/ui";
  import { libraryTotal, allArticlesUnread } from "$lib/stores/counts";

  function toggleMenu() {
    isMobileMenuOpen.update((v) => !v);
  }
</script>

<nav
  class="md:hidden fixed bottom-0 left-0 right-0 min-h-[52px] bg-zinc-950 border-t border-zinc-700/80 z-[2100] flex items-center justify-around px-2 pt-1.5 select-none safe-bottom shadow-[0_-4px_24px_rgba(0,0,0,0.5)]"
>
  <!-- Menu Button -->
  <button
    on:click={toggleMenu}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
  >
    <div
      class="relative p-1.5 rounded-xl transition-all duration-300 {$isMobileMenuOpen
        ? 'bg-zinc-800'
        : ''}"
    >
      <Menu
        size={22}
        class="transition-colors duration-300 {$isMobileMenuOpen
          ? 'text-accent'
          : 'text-zinc-500'}"
        strokeWidth={$isMobileMenuOpen ? 2.5 : 2}
      />
    </div>
    <span
      class="text-[10px] font-medium {$isMobileMenuOpen
        ? 'text-white'
        : 'text-zinc-500'}"
    >
      Menu
    </span>
  </button>

  <!-- All Articles Button -->
  <button
    on:click={setViewAll}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
  >
    <div
      class="relative p-1.5 rounded-xl transition-all duration-300 {$viewMode ===
      'all'
        ? 'bg-zinc-800'
        : ''}"
    >
      <LayoutDashboard
        size={22}
        class="transition-colors duration-300 {$viewMode === 'all'
          ? 'text-accent'
          : 'text-zinc-500'}"
        strokeWidth={$viewMode === "all" ? 2.5 : 2}
      />
      {#if $allArticlesUnread > 0}
        <span
          class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[14px] text-center border border-zinc-950 shadow-lg"
        >
          {$allArticlesUnread > 99 ? "99+" : $allArticlesUnread}
        </span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium {$viewMode === 'all'
        ? 'text-white'
        : 'text-zinc-500'}"
    >
      All
    </span>
  </button>

  <!-- Unread Button (labeled as Today in the image) -->
  <button
    on:click={setViewUnread}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
  >
    <div
      class="relative p-1.5 rounded-xl transition-all duration-300 {$viewMode ===
      'unread'
        ? 'bg-zinc-800'
        : ''}"
    >
      <Eye
        size={22}
        class="transition-colors duration-300 {$viewMode === 'unread'
          ? 'text-accent'
          : 'text-zinc-500'}"
        strokeWidth={$viewMode === "unread" ? 2.5 : 2}
      />
      {#if $allArticlesUnread > 0}
        <span
          class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[14px] text-center border border-zinc-950 shadow-lg"
        >
          {$allArticlesUnread > 99 ? "99+" : $allArticlesUnread}
        </span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium {$viewMode === 'unread'
        ? 'text-white'
        : 'text-zinc-500'}"
    >
      Today
    </span>
  </button>

  <!-- Bookmarks Button -->
  <button
    on:click={setViewBookmarks}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
  >
    <div
      class="relative p-1.5 rounded-xl transition-all duration-300 {$viewMode ===
      'bookmarks'
        ? 'bg-zinc-800'
        : ''}"
    >
      <Bookmark
        size={22}
        class="transition-colors duration-300 {$viewMode === 'bookmarks'
          ? 'text-[#FF9500]'
          : 'text-zinc-500'}"
        fill={$viewMode === "bookmarks" ? "currentColor" : "none"}
        strokeWidth={$viewMode === "bookmarks" ? 2.5 : 2}
      />
      {#if $libraryTotal > 0}
        <span
          class="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[14px] text-center border border-zinc-950"
        >
          {$libraryTotal}
        </span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium {$viewMode === 'bookmarks'
        ? 'text-white'
        : 'text-zinc-500'}"
    >
      Bookmarks
    </span>
  </button>
</nav>

<style>
  .safe-bottom {
    padding-bottom: env(safe-area-inset-bottom, 16px);
  }
</style>
