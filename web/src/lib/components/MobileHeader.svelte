<script lang="ts">
  import { tick } from "svelte";
  import { Search, Plus, RefreshCw, X, FolderPlus, Rss } from "lucide-svelte";
  import { isAddFeedModalOpen, isCreateFolderModalOpen, isMobileMenuOpen } from "$lib/stores/ui";

  export let title = "FeedStream";
  export let searchQuery = "";
  export let onSearchInput: () => void = () => {};
  export let onSearchClear: () => void = () => {};
  export let onRefresh: () => void = () => {};
  export let isRefreshing = false;
  export let refreshCountdownTitle = "Auto refresh is off";
  export let refreshStreamStatus: "connecting" | "connected" | "reconnecting" =
    "connecting";

  let isSearchOpen = false;
  let headerHeight = 52;
  let searchInput: HTMLInputElement | null = null;

  function openAddFeed() {
    isAddFeedModalOpen.set(true);
  }

  function toggleMenu() {
    isMobileMenuOpen.update((v) => !v);
  }

  async function toggleSearch() {
    isSearchOpen = !isSearchOpen;
    if (isSearchOpen) {
      await tick();
      searchInput?.focus();
    } else {
      searchInput?.blur();
    }
  }

  function handleSearchClear() {
    onSearchClear();
    isSearchOpen = false;
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      isSearchOpen = false;
      searchInput?.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      handleSearchClear();
      searchInput?.blur();
    }
  }

  $: if (typeof document !== "undefined") {
    document.documentElement.style.setProperty(
      "--mobile-header-height",
      `${headerHeight}px`
    );
  }
</script>

<!-- Mobile-only sticky header -->
<header
  class="md:hidden fixed top-0 left-0 right-0 w-full z-30 bg-background border-b border-stroke pt-safe"
  bind:clientHeight={headerHeight}
>
  <div class="flex items-center justify-between gap-2 px-4 py-3">
    <!-- Brand / Menu Toggle -->
    <button 
      class="flex items-center gap-3 min-w-0 active:opacity-70 transition-opacity text-left"
      on:click={toggleMenu}
      aria-label="Open menu"
    >
      <div
        class="w-8 h-8 rounded-full bg-surface border border-stroke flex items-center justify-center"
      >
        <Rss size={16} class="text-accent" />
      </div>
      <span class="text-lg font-bold text-white tracking-tight truncate max-w-[160px]">{title}</span>
    </button>

    <!-- Actions -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <button
        on:click={toggleSearch}
        class="w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-stroke text-zinc-400 hover:text-white active:scale-95 transition-all"
        aria-label={isSearchOpen ? "Close search" : "Open search"}
      >
        {#if isSearchOpen}
          <X size={18} />
        {:else}
          <Search size={18} />
        {/if}
      </button>

      <button
        on:click={onRefresh}
        class="w-9 h-9 flex items-center justify-center rounded-full bg-surface border border-stroke text-zinc-400 hover:text-white active:scale-95 transition-all"
        title={refreshCountdownTitle}
      >
        <div class="relative">
          <RefreshCw size={18} class={isRefreshing ? "animate-spin text-accent" : ""} />
          {#if refreshStreamStatus === "connected"}
             <span class="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full border-2 border-surface"></span>
          {/if}
        </div>
      </button>
      
      <button
        on:click={openAddFeed}
        class="w-9 h-9 flex items-center justify-center rounded-full bg-accent text-zinc-950 active:scale-95 transition-all shadow-lg shadow-accent/20 z-40"
        aria-label="Add feed"
      >
        <Plus size={20} strokeWidth={2.5} />
      </button>
    </div>
  </div>

  <div class="mobile-search bg-background border-b border-stroke" class:open={isSearchOpen}>
    <div class="relative px-4 py-3">
      <Search size={16} class="absolute left-7 top-1/2 -translate-y-1/2 text-zinc-500" />
      <input
        bind:this={searchInput}
        type="search"
        placeholder="Search articles..."
        bind:value={searchQuery}
        on:input={onSearchInput}
        on:keydown={handleSearchKeydown}
        class="w-full bg-surface pl-10 pr-10 h-10 rounded-xl text-white placeholder-zinc-500 outline-none border border-stroke focus:border-accent transition-colors text-sm font-medium"
      />
      {#if searchQuery}
        <button
          on:click={handleSearchClear}
          class="absolute right-7 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
        >
          <X size={16} />
        </button>
      {/if}
    </div>
  </div>
</header>

<style>
  .mobile-search {
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.2, 0, 0, 1);
  }

  .mobile-search.open {
    max-height: 70px;
    opacity: 1;
  }
</style>
