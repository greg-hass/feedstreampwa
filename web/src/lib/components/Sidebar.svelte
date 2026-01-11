<script lang="ts">
  import { page } from "$app/stores";
  import {
    LayoutDashboard,
    List,
    Bookmark,
    Settings,
    PlusCircle,
    Rss,
    Youtube,
    MessageCircle,
    Mic,
  } from "lucide-svelte";
  import {
    isAddFeedModalOpen,
    isSettingsModalOpen,
    viewMode,
    activeSmartFolder,
    setViewSmartFolder,
    setViewAll,
  } from "$lib/stores/ui";
  import {
    allArticlesUnread,
    allArticlesTotal,
    libraryTotal,
    totalFeeds,
    rssCount,
    youtubeCount,
    redditCount,
    podcastCount,
    formatUnreadTotal,
    formatCount,
  } from "$lib/stores/counts";

  // Navigation Items
  const navItems = [
    { label: "Feeds", icon: List, href: "/feeds", countStore: totalFeeds },
    { label: "Library", icon: Bookmark, href: "/library", countStore: libraryTotal },
  ];

  $: activeUrl = $page.url.pathname;
</script>

<aside
  class="hidden md:flex flex-col w-[280px] h-screen fixed left-0 top-0 z-40 bg-black/90 backdrop-blur-sm border-r border-white/5"
>
  <!-- Brand -->
  <div class="p-6 pt-8">
    <h1
      class="text-2xl font-bold tracking-tight text-white flex items-center gap-2"
    >
      <div
        class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20"
      >
        <Rss size={18} class="text-white" />
      </div>
      FeedStream
    </h1>
  </div>

  <!-- Main Nav -->
  <div class="flex-1 px-4 py-2 space-y-1 overflow-y-auto scrollbar-hide">
    <div
      class="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-2"
    >
      Menu
    </div>

    <!-- All Articles Button -->
    <a
      href="/"
      on:click={() => setViewAll()}
      class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
      {activeUrl === '/'
        ? 'bg-white/10 text-white shadow-inner border border-white/5'
        : 'text-white/60 hover:text-white hover:bg-white/5'}"
    >
      <div class="flex items-center gap-3">
        <LayoutDashboard
          size={24}
          class={activeUrl === '/'
            ? "text-accent"
            : "text-current group-hover:text-white"}
        />
        All Articles
      </div>

      {#if $allArticlesTotal > 0}
        <span class="text-xs font-medium {activeUrl === '/' ? 'text-white/70' : 'text-white/40'}">
          {formatUnreadTotal($allArticlesUnread, $allArticlesTotal)}
        </span>
      {/if}

      {#if activeUrl === '/'}
        <div
          class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
        ></div>
      {/if}
    </a>

    <!-- Feeds Button -->
    <a
      href="/feeds"
      class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
      {activeUrl === '/feeds'
        ? 'bg-white/10 text-white shadow-inner border border-white/5'
        : 'text-white/60 hover:text-white hover:bg-white/5'}"
    >
      <div class="flex items-center gap-3">
        <List
          size={24}
          class={activeUrl === '/feeds'
            ? "text-accent"
            : "text-current group-hover:text-white"}
        />
        Feeds
      </div>

      {#if $totalFeeds > 0}
        <span class="text-xs font-medium {activeUrl === '/feeds' ? 'text-white/70' : 'text-white/40'}">
          {formatCount($totalFeeds)}
        </span>
      {/if}

      {#if activeUrl === '/feeds'}
        <div
          class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
        ></div>
      {/if}
    </a>

    <!-- Library Button -->
    <a
      href="/library"
      class="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
      {activeUrl === '/library'
        ? 'bg-white/10 text-white shadow-inner border border-white/5'
        : 'text-white/60 hover:text-white hover:bg-white/5'}"
    >
      <div class="flex items-center gap-3">
        <Bookmark
          size={24}
          class={activeUrl === '/library'
            ? "text-accent"
            : "text-current group-hover:text-white"}
        />
        Library
      </div>

      {#if $libraryTotal > 0}
        <span class="text-xs font-medium {activeUrl === '/library' ? 'text-white/70' : 'text-white/40'}">
          {formatCount($libraryTotal)}
        </span>
      {/if}

      {#if activeUrl === '/library'}
        <div
          class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
        ></div>
      {/if}
    </a>

    <!-- Smart Folders Section -->
    <div
      class="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-8"
    >
      Smart Folders
    </div>
    <button
      class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
        {$viewMode === 'smart' && $activeSmartFolder === 'rss'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      on:click={() => setViewSmartFolder('rss')}
    >
      <div class="flex items-center gap-3">
        <Rss
          size={24}
          class={$viewMode === 'smart' && $activeSmartFolder === 'rss'
            ? 'text-accent'
            : 'text-current group-hover:text-white'}
        />
        RSS
      </div>

      {#if $rssCount.total > 0}
        <span class="text-xs font-medium {$viewMode === 'smart' && $activeSmartFolder === 'rss' ? 'text-white/70' : 'text-white/40'}">
          {formatUnreadTotal($rssCount.unread, $rssCount.total)}
        </span>
      {/if}

      {#if $viewMode === 'smart' && $activeSmartFolder === 'rss'}
        <div
          class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
        ></div>
      {/if}
    </button>
    <button
      class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
        {$viewMode === 'smart' && $activeSmartFolder === 'youtube'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      on:click={() => setViewSmartFolder('youtube')}
    >
      <div class="flex items-center gap-3">
        <Youtube
          size={24}
          class={$viewMode === 'smart' && $activeSmartFolder === 'youtube'
            ? 'text-accent'
            : 'text-current group-hover:text-white'}
        />
        YouTube
      </div>

      {#if $youtubeCount.total > 0}
        <span class="text-xs font-medium {$viewMode === 'smart' && $activeSmartFolder === 'youtube' ? 'text-white/70' : 'text-white/40'}">
          {formatUnreadTotal($youtubeCount.unread, $youtubeCount.total)}
        </span>
      {/if}

      {#if $viewMode === 'smart' && $activeSmartFolder === 'youtube'}
        <div
          class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
        ></div>
      {/if}
    </button>
    <button
      class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
        {$viewMode === 'smart' && $activeSmartFolder === 'reddit'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      on:click={() => setViewSmartFolder('reddit')}
    >
      <div class="flex items-center gap-3">
        <MessageCircle
          size={24}
          class={$viewMode === 'smart' && $activeSmartFolder === 'reddit'
            ? 'text-accent'
            : 'text-current group-hover:text-white'}
        />
        Reddit
      </div>

      {#if $redditCount.total > 0}
        <span class="text-xs font-medium {$viewMode === 'smart' && $activeSmartFolder === 'reddit' ? 'text-white/70' : 'text-white/40'}">
          {formatUnreadTotal($redditCount.unread, $redditCount.total)}
        </span>
      {/if}

      {#if $viewMode === 'smart' && $activeSmartFolder === 'reddit'}
        <div
          class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
        ></div>
      {/if}
    </button>
    <button
      class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
        {$viewMode === 'smart' && $activeSmartFolder === 'podcast'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      on:click={() => setViewSmartFolder('podcast')}
    >
      <div class="flex items-center gap-3">
        <Mic
          size={24}
          class={$viewMode === 'smart' && $activeSmartFolder === 'podcast'
            ? 'text-accent'
            : 'text-current group-hover:text-white'}
        />
        Podcasts
      </div>

      {#if $podcastCount.total > 0}
        <span class="text-xs font-medium {$viewMode === 'smart' && $activeSmartFolder === 'podcast' ? 'text-white/70' : 'text-white/40'}">
          {formatUnreadTotal($podcastCount.unread, $podcastCount.total)}
        </span>
      {/if}

      {#if $viewMode === 'smart' && $activeSmartFolder === 'podcast'}
        <div
          class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
        ></div>
      {/if}
    </button>
  </div>

  <!-- User / Settings at bottom -->
  <div class="p-4 border-t border-white/5">
    <div
      class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
      on:click={() => isSettingsModalOpen.set(true)}
      on:keydown={(e) => e.key === "Enter" && isSettingsModalOpen.set(true)}
      tabindex="0"
      role="button"
    >
      <Settings size={24} class="text-white/60" />
      <span class="text-sm font-medium text-white">Settings</span>
    </div>
  </div>

  <!-- Slot for Player if Desktop -->
  <slot name="player" />
</aside>
