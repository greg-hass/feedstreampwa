<script lang="ts">
  import { Search, Plus, RefreshCw, X, FolderPlus } from "lucide-svelte";
  import { isAddFeedModalOpen, isCreateFolderModalOpen } from "$lib/stores/ui";

  export let searchQuery = "";
  export let onSearchInput: () => void = () => {};
  export let onSearchClear: () => void = () => {};
  export let onRefresh: () => void = () => {};
  export let isRefreshing = false;
  export let refreshCountdown = "Off";
  export let refreshCountdownTitle = "Auto refresh is off";

  function openAddFeed() {
    isAddFeedModalOpen.set(true);
  }
</script>

<!-- Mobile-only sticky header -->
<header
  class="md:hidden fixed top-0 left-0 right-0 w-full z-30 bg-background border-b border-white/5"
>
  <div class="flex items-center gap-2 px-2 py-2">
    <!-- Search Bar -->
    <div class="flex-1 relative">
      <Search
        size={18}
        class="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
      />
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

    <!-- Action Buttons (Matched to Desktop) -->
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <button
        on:click={onRefresh}
        class="p-2 rounded-xl bg-[#3f3f46] hover:bg-[#52525b] text-white active:scale-95 transition-all"
        class:animate-spin={isRefreshing}
        aria-label="Refresh"
      >
        <RefreshCw size={20} />
      </button>
      <span
        class="text-[11px] font-semibold text-white/60"
        title={refreshCountdownTitle}
      >
        {refreshCountdown}
      </span>
    </div>

    <button
      on:click={() => isCreateFolderModalOpen.set(true)}
      class="p-2 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-zinc-900 active:scale-95 transition-all flex-shrink-0"
      aria-label="Add folder"
    >
      <FolderPlus size={20} />
    </button>

    <button
      on:click={openAddFeed}
      class="p-2 rounded-xl bg-accent text-white active:scale-95 transition-all flex-shrink-0"
      aria-label="Add feed"
    >
      <Plus size={20} />
    </button>
  </div>
</header>

<style>
  .animate-spin {
    animation: spin 1s linear infinite;
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
