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
  class="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-stroke z-[2100] flex items-center justify-around px-2 pt-2 pb-safe select-none"
>
  <!-- Menu Button -->
  <button
    on:click={toggleMenu}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-200 py-1"
  >
    <div
      class="relative p-1.5 rounded-2xl transition-all duration-300 {$isMobileMenuOpen
        ? 'bg-zinc-800 text-white'
        : 'text-zinc-500'}"
    >
      <Menu
        size={24}
        strokeWidth={$isMobileMenuOpen ? 2.5 : 2}
      />
    </div>
    <span
      class="text-[10px] font-medium transition-colors {$isMobileMenuOpen
        ? 'text-white'
        : 'text-zinc-500'}"
    >
      Menu
    </span>
  </button>

  <!-- All Articles Button -->
  <button
    on:click={setViewAll}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-200 py-1"
  >
    <div
      class="relative p-1.5 rounded-2xl transition-all duration-300 {$viewMode ===
      'all'
        ? 'bg-zinc-800 text-white'
        : 'text-zinc-500'}"
    >
      <LayoutDashboard
        size={24}
        strokeWidth={$viewMode === "all" ? 2.5 : 2}
      />
      {#if $allArticlesUnread > 0}
        <span
          class="absolute -top-1 -right-1 bg-accent text-zinc-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[14px] text-center border-2 border-background"
        >
          {$allArticlesUnread > 99 ? "99+" : $allArticlesUnread}
        </span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium transition-colors {$viewMode === 'all'
        ? 'text-white'
        : 'text-zinc-500'}"
    >
      All
    </span>
  </button>

  <!-- Unread Button (Today) -->
  <button
    on:click={setViewUnread}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-200 py-1"
  >
    <div
      class="relative p-1.5 rounded-2xl transition-all duration-300 {$viewMode ===
      'unread'
        ? 'bg-zinc-800 text-white'
        : 'text-zinc-500'}"
    >
      <Eye
        size={24}
        strokeWidth={$viewMode === "unread" ? 2.5 : 2}
      />
      {#if $allArticlesUnread > 0}
        <span
          class="absolute -top-1 -right-1 bg-accent text-zinc-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[14px] text-center border-2 border-background"
        >
          {$allArticlesUnread > 99 ? "99+" : $allArticlesUnread}
        </span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium transition-colors {$viewMode === 'unread'
        ? 'text-white'
        : 'text-zinc-500'}"
    >
      Today
    </span>
  </button>

  <!-- Bookmarks Button -->
  <button
    on:click={setViewBookmarks}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-200 py-1"
  >
    <div
      class="relative p-1.5 rounded-2xl transition-all duration-300 {$viewMode ===
      'bookmarks'
        ? 'bg-zinc-800 text-white'
        : 'text-zinc-500'}"
    >
      <Bookmark
        size={24}
        fill={$viewMode === "bookmarks" ? "currentColor" : "none"}
        strokeWidth={$viewMode === "bookmarks" ? 2.5 : 2}
      />
      {#if $libraryTotal > 0}
        <span
          class="absolute -top-1 -right-1 bg-accent text-zinc-950 text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[14px] text-center border-2 border-background"
        >
          {$libraryTotal}
        </span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium transition-colors {$viewMode === 'bookmarks'
        ? 'text-white'
        : 'text-zinc-500'}"
    >
      Saved
    </span>
  </button>
</nav>

<style>
  /* Use global variable for safe area */
  .pb-safe {
    padding-bottom: var(--safe-bottom, 20px);
  }
</style>
