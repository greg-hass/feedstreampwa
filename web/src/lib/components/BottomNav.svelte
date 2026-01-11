<script lang="ts">
  import { LayoutDashboard, List, Bookmark } from "lucide-svelte";
  import { isMobileMenuOpen, setViewAll, setViewBookmarks, viewMode } from "$lib/stores/ui";
  import { libraryTotal } from "$lib/stores/counts";

  function toggleMenu() {
    isMobileMenuOpen.update(v => !v);
  }
</script>

<nav
  class="md:hidden fixed bottom-0 left-0 right-0 min-h-[64px] bg-background border-t border-white/5 z-40 flex items-center justify-around px-2 pt-2 pb-safe select-none"
>
  <!-- All Articles Button -->
  <button
    on:click={setViewAll}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
  >
    <div
      class="relative p-1.5 rounded-xl transition-all duration-300 {$viewMode === 'all'
        ? 'bg-white/10'
        : ''}"
    >
      <LayoutDashboard
        size={22}
        class="transition-colors duration-300 {$viewMode === 'all'
          ? 'text-white'
          : 'text-white/40'}"
        strokeWidth={$viewMode === 'all' ? 2.5 : 2}
      />
      {#if $viewMode === 'all'}
        <span
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"
        ></span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium {$viewMode === 'all'
        ? 'text-white'
        : 'text-white/40'}"
    >
      All Articles
    </span>
  </button>

  <!-- Bookmarks Button -->
  <button
    on:click={setViewBookmarks}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
  >
    <div
      class="relative p-1.5 rounded-xl transition-all duration-300 {$viewMode === 'bookmarks'
        ? 'bg-white/10'
        : ''}"
    >
      <Bookmark
        size={22}
        class="transition-colors duration-300 {$viewMode === 'bookmarks'
          ? 'text-[#FF9500]'
          : 'text-white/40'}"
        fill={$viewMode === 'bookmarks' ? "currentColor" : "none"}
        strokeWidth={$viewMode === 'bookmarks' ? 2.5 : 2}
      />
      {#if $libraryTotal > 0}
        <span class="absolute -top-1 -right-1 bg-[#FF9500] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[14px] text-center border border-background">
          {$libraryTotal}
        </span>
      {/if}
      {#if $viewMode === 'bookmarks'}
        <span
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#FF9500] rounded-full shadow-[0_0_8px_rgba(255,149,0,0.8)]"
        ></span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium {$viewMode === 'bookmarks'
        ? 'text-white'
        : 'text-white/40'}"
    >
      Bookmarks
    </span>
  </button>

  <!-- Feeds (Menu) Button -->
  <button
    on:click={toggleMenu}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
  >
    <div
      class="relative p-1.5 rounded-xl transition-all duration-300 {$isMobileMenuOpen
        ? 'bg-white/10'
        : ''}"
    >
      <List
        size={22}
        class="transition-colors duration-300 {$isMobileMenuOpen
          ? 'text-white'
          : 'text-white/40'}"
        strokeWidth={$isMobileMenuOpen ? 2.5 : 2}
      />
      {#if $isMobileMenuOpen}
        <span
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"
        ></span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium {$isMobileMenuOpen
        ? 'text-white'
        : 'text-white/40'}"
    >
      Feeds
    </span>
  </button>
</nav>
