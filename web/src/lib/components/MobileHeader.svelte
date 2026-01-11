<script lang="ts">
  import { page } from "$app/stores";
  import { Menu, Search, PlusCircle } from "lucide-svelte";
  import { isMobileMenuOpen, isAddFeedModalOpen, activeSmartFolder, viewMode } from "$lib/stores/ui";

  // Get page title based on current route
  $: currentPath = $page.url.pathname;
  $: pageTitle = getPageTitle(currentPath, $viewMode, $activeSmartFolder);

  function getPageTitle(path: string, mode: typeof $viewMode, smartFolder: typeof $activeSmartFolder): string {
    // Smart folder view
    if (mode === 'smart' && smartFolder) {
      const folderNames = {
        youtube: 'YouTube',
        reddit: 'Reddit',
        podcast: 'Podcasts',
        rss: 'RSS Feeds'
      };
      return folderNames[smartFolder] || 'Feed';
    }

    // Route-based titles
    switch (path) {
      case '/':
        return 'Dashboard';
      case '/feeds':
        return 'My Feeds';
      case '/library':
        return 'Library';
      case '/explore':
        return 'Explore';
      default:
        return 'FeedStream';
    }
  }

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
  <div class="flex items-center justify-between px-4 py-3">
    <!-- Menu Button -->
    <button
      on:click={openMenu}
      class="p-2 -ml-2 rounded-xl hover:bg-white/10 transition-colors active:scale-95"
      aria-label="Open menu"
    >
      <Menu size={22} class="text-white" />
    </button>

    <!-- Page Title -->
    <h1 class="text-lg font-semibold text-white truncate mx-4 flex-1 text-center">
      {pageTitle}
    </h1>

    <!-- Quick Actions -->
    <div class="flex items-center gap-1">
      {#if currentPath === '/'}
        <!-- Add Feed button on home -->
        <button
          on:click={openAddFeed}
          class="p-2 rounded-xl hover:bg-white/10 transition-colors active:scale-95"
          aria-label="Add feed"
        >
          <PlusCircle size={20} class="text-accent" />
        </button>
      {:else if currentPath === '/explore'}
        <!-- Search is the main feature on explore, no extra button needed -->
        <div class="w-9"></div>
      {:else}
        <!-- Placeholder for alignment -->
        <div class="w-9"></div>
      {/if}
    </div>
  </div>
</header>
