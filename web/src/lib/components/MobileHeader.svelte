<script lang="ts">
  import { tick } from "svelte";
  import { Search, Plus, RefreshCw, X, FolderPlus, Rss } from "lucide-svelte";
  import { isAddFeedModalOpen, isCreateFolderModalOpen } from "$lib/stores/ui";

  export let searchQuery = "";
  export let onSearchInput: () => void = () => {};
  export let onSearchClear: () => void = () => {};
  export let onRefresh: () => void = () => {};
  export let isRefreshing = false;
  export let refreshCountdown = "Off";
  export let refreshCountdownTitle = "Auto refresh is off";

  let isSearchOpen = false;
  let headerHeight = 52;
  let searchInput: HTMLInputElement | null = null;

  function openAddFeed() {
    isAddFeedModalOpen.set(true);
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
  class="md:hidden fixed top-0 left-0 right-0 w-full z-30 bg-background border-b border-white/5"
  bind:clientHeight={headerHeight}
>
  <div class="flex items-center justify-between gap-2 px-3 py-2">
    <div class="flex items-center gap-2 min-w-0">
      <div
        class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20"
      >
        <Rss size={16} class="text-white" />
      </div>
      <span class="text-base font-semibold text-white truncate">FeedStream</span>
    </div>

    <div class="flex items-center gap-1.5 flex-shrink-0">
      <button
        on:click={toggleSearch}
        class="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 active:scale-95 transition-all"
        class:text-accent={searchQuery.length > 0}
        aria-label={isSearchOpen ? "Close search" : "Open search"}
        aria-expanded={isSearchOpen}
      >
        {#if isSearchOpen}
          <X size={20} />
        {:else}
          <Search size={20} />
        {/if}
      </button>

      <button
        on:click={onRefresh}
        class="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#3f3f46] hover:bg-[#52525b] text-white active:scale-95 transition-all"
        title={refreshCountdownTitle}
        aria-label="Refresh"
      >
        <span class="text-[11px] font-semibold text-white/70">
          {refreshCountdown}
        </span>
        <RefreshCw size={20} class={isRefreshing ? "animate-spin" : ""} />
      </button>

      <button
        on:click={() => isCreateFolderModalOpen.set(true)}
        class="p-2 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-zinc-900 active:scale-95 transition-all"
        aria-label="Add folder"
      >
        <FolderPlus size={20} />
      </button>

      <button
        on:click={openAddFeed}
        class="p-2 rounded-xl bg-accent text-white active:scale-95 transition-all"
        aria-label="Add feed"
      >
        <Plus size={20} />
      </button>
    </div>
  </div>

  <div class="mobile-search" class:open={isSearchOpen}>
    <div class="relative px-3 pb-2">
      <Search
        size={18}
        class="absolute left-6 top-1/2 -translate-y-1/2 text-white/40"
      />
      <input
        bind:this={searchInput}
        type="search"
        placeholder="Search..."
        bind:value={searchQuery}
        on:input={onSearchInput}
        on:keydown={handleSearchKeydown}
        class="w-full bg-white/5 pl-10 pr-10 py-2 rounded-xl text-white placeholder-white/40 outline-none border border-white/10 focus:border-accent/50 transition-colors text-sm"
      />
      {#if searchQuery}
        <button
          on:click={handleSearchClear}
          class="absolute right-6 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      {/if}
    </div>
  </div>
</header>

<style>
  .animate-spin {
    animation: spin 1s linear infinite;
  }

  .mobile-search {
    max-height: 0;
    opacity: 0;
    transform: translateY(-4px);
    overflow: hidden;
    transition: max-height 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
  }

  .mobile-search.open {
    max-height: 72px;
    opacity: 1;
    transform: translateY(0);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
