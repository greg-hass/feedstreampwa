<script lang="ts">
  import { Menu, Search, PlusCircle, RefreshCw, X } from "lucide-svelte";
  import { isMobileMenuOpen, isAddFeedModalOpen } from "$lib/stores/ui";

  export let searchQuery = "";
  export let onSearchInput: () => void = () => {};
  export let onSearchClear: () => void = () => {};
  export let onRefresh: () => void = () => {};
  export let isRefreshing = false;

  function openMenu() {
    isMobileMenuOpen.set(true);
  }

  function openAddFeed() {
    isAddFeedModalOpen.set(true);
  }
</script>

<!-- Mobile-only sticky header -->
<header
  class="md:hidden sticky top-0 z-30 bg-[#050507]/90 backdrop-blur-xl border-b border-white/10"
>
  <div class="flex items-center gap-2 px-3 py-2">
    <!-- Menu Button -->
    <button
      on:click={openMenu}
      class="p-2 rounded-xl hover:bg-white/10 transition-colors active:scale-95 flex-shrink-0"
      aria-label="Open menu"
    >
      <Menu size={22} class="text-white" />
    </button>

    <!-- Search Bar -->
    <div class="flex-1 relative">
      <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
      <input
        type="text"
        placeholder="Search..."
        bind:value={searchQuery}
        on:input={onSearchInput}
        class="w-full bg-white/5 pl-10 pr-10 py-2 rounded-xl text-white placeholder-white/40 outline-none border border-white/10 focus:border-accent/50 transition-colors text-sm"
      />
      {#if searchQuery}
        <button
          on:click={onSearchClear}
          class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
        >
          <X size={16} />
        </button>
      {/if}
    </div>

    <!-- Action Buttons -->
    <button
      on:click={onRefresh}
      class="p-2 rounded-xl hover:bg-white/10 transition-colors active:scale-95 flex-shrink-0"
      class:animate-spin={isRefreshing}
      aria-label="Refresh"
    >
      <RefreshCw size={20} class="text-white" />
    </button>

    <button
      on:click={openAddFeed}
      class="p-2 rounded-xl hover:bg-white/10 transition-colors active:scale-95 flex-shrink-0"
      aria-label="Add feed"
    >
      <PlusCircle size={20} class="text-accent" />
    </button>
  </div>
</header>
