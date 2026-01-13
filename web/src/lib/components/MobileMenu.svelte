<script context="module">
  import { fade, fly } from "svelte/transition";
</script>

<script lang="ts">
  import { page } from "$app/stores";
  import {
    X,
    LayoutDashboard,
    List,
    Bookmark,
    Circle,
    Settings,
    Rss,
    Youtube,
    Mic,
    FolderOpen,
    ChevronRight,
    ChevronDown,
  } from "lucide-svelte";
  import RedditIcon from "./icons/RedditIcon.svelte";
  import {
    isMobileMenuOpen,
    isSettingsModalOpen,
    viewMode,
    activeSmartFolder,
    activeFolderId,
    selectedFeedUrl,
    setViewSmartFolder,
    setViewAll,
    setViewUnread,
    setViewBookmarks,
    setViewFolder,
    setViewFeed,
  } from "$lib/stores/ui";
  import {
    feedsTree,
    folderUnreadCounts,
    rssCount,
    youtubeCount,
    redditCount,
    podcastCount,
    formatUnreadTotal,
    libraryTotal,
    allArticlesUnread,
  } from "$lib/stores/counts";
  import { folders } from "$lib/stores/folders";

  $: activeUrl = $page.url.pathname;

  let openFolders: Record<string, boolean> = {};

  function toggleFolder(e: MouseEvent, id: string) {
    e.stopPropagation();
    openFolders[id] = !openFolders[id];
  }

  function closeMenu() {
    isMobileMenuOpen.set(false);
  }

  function handleSettings() {
    closeMenu();
    isSettingsModalOpen.set(true);
  }

  // Close menu when clicking backdrop
  function handleBackdropClick() {
    closeMenu();
  }

  // Close on escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && $isMobileMenuOpen) {
      closeMenu();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $isMobileMenuOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === "Enter" && handleBackdropClick()}
    role="button"
    tabindex="-1"
    transition:fade={{ duration: 200 }}
  />

  <!-- Slide-in Menu -->
  <aside
    class="fixed left-0 top-0 h-full w-[280px] bg-[#121212] border-r border-white/10 z-[70] md:hidden overflow-y-auto shadow-2xl"
    transition:fly={{ x: -280, duration: 300, opacity: 1 }}
  >
    <!-- Header -->
    <div class="p-6 pt-8 flex items-center justify-between">
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
      <button
        class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
        on:click={closeMenu}
        aria-label="Close menu"
      >
        <X size={20} />
      </button>
    </div>

    <!-- Main Nav -->
    <div class="px-4 py-2 space-y-1">
      <div
        class="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-2"
      >
        Menu
      </div>

      <!-- All Articles Button -->
      <button
        on:click={() => {
          setViewAll();
          closeMenu();
        }}
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
        {$viewMode === 'all'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      >
        <div class="flex items-center gap-3">
          <LayoutDashboard
            size={24}
            class={$viewMode === "all"
              ? "text-accent"
              : "text-current group-hover:text-white"}
          />
          All Articles
        </div>
        {#if $viewMode === "all"}
          <div
            class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
          ></div>
        {/if}
      </button>

      <!-- Unread Button -->
      <button
        on:click={() => {
          setViewUnread();
          closeMenu();
        }}
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
        {$viewMode === 'unread'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      >
        <div class="flex items-center gap-3">
          <Circle
            size={24}
            class={$viewMode === "unread"
              ? "text-blue-400"
              : "text-current group-hover:text-white"}
            fill={$viewMode === "unread" ? "currentColor" : "none"}
          />
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
        {#if $viewMode === "unread"}
          <div
            class="absolute inset-y-0 left-0 w-1 bg-blue-400 rounded-r-full shadow-[0_0_10px_2px_rgba(96,165,250,0.5)]"
          ></div>
        {/if}
      </button>

      <!-- Bookmarks Button -->
      <button
        on:click={() => {
          setViewBookmarks();
          closeMenu();
        }}
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
        {$viewMode === 'bookmarks'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      >
        <div class="flex items-center gap-3">
          <Bookmark
            size={24}
            class={$viewMode === "bookmarks"
              ? "text-[#FF9500]"
              : "text-current group-hover:text-white"}
            fill={$viewMode === "bookmarks" ? "currentColor" : "none"}
          />
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
        {#if $viewMode === "bookmarks"}
          <div
            class="absolute inset-y-0 left-0 w-1 bg-[#FF9500] rounded-r-full shadow-[0_0_10px_2px_rgba(255,149,0,0.5)]"
          ></div>
        {/if}
      </button>

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
        on:click={() => {
          setViewSmartFolder("rss");
          closeMenu();
        }}
      >
        <div class="flex items-center gap-3">
          <Rss
            size={24}
            class={$viewMode === "smart" && $activeSmartFolder === "rss"
              ? "text-accent"
              : "text-accent/70 group-hover:text-accent"}
          />
          RSS
        </div>
        {#if $rssCount.total > 0}
          <span
            class="text-xs font-medium {$viewMode === 'smart' &&
            $activeSmartFolder === 'rss'
              ? 'text-white/70'
              : 'text-white/40'}"
          >
            {formatUnreadTotal($rssCount.unread, $rssCount.total)}
          </span>
        {/if}
      </button>

      <button
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
          {$viewMode === 'smart' && $activeSmartFolder === 'youtube'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
        on:click={() => {
          setViewSmartFolder("youtube");
          closeMenu();
        }}
      >
        <div class="flex items-center gap-3">
          <Youtube
            size={24}
            class={$viewMode === "smart" && $activeSmartFolder === "youtube"
              ? "text-red-500"
              : "text-red-500/70 group-hover:text-red-500"}
          />
          YouTube
        </div>
        {#if $youtubeCount.total > 0}
          <span
            class="text-xs font-medium {$viewMode === 'smart' &&
            $activeSmartFolder === 'youtube'
              ? 'text-white/70'
              : 'text-white/40'}"
          >
            {formatUnreadTotal($youtubeCount.unread, $youtubeCount.total)}
          </span>
        {/if}
      </button>

      <button
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
          {$viewMode === 'smart' && $activeSmartFolder === 'reddit'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
        on:click={() => {
          setViewSmartFolder("reddit");
          closeMenu();
        }}
      >
        <div class="flex items-center gap-3">
          <RedditIcon
            size={24}
            class={$viewMode === "smart" && $activeSmartFolder === "reddit"
              ? "text-orange-400"
              : "text-orange-400/70 group-hover:text-orange-400"}
          />
          Reddit
        </div>
        {#if $redditCount.total > 0}
          <span
            class="text-xs font-medium {$viewMode === 'smart' &&
            $activeSmartFolder === 'reddit'
              ? 'text-white/70'
              : 'text-white/40'}"
          >
            {formatUnreadTotal($redditCount.unread, $redditCount.total)}
          </span>
        {/if}
      </button>

      <button
        class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
          {$viewMode === 'smart' && $activeSmartFolder === 'podcast'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
        on:click={() => {
          setViewSmartFolder("podcast");
          closeMenu();
        }}
      >
        <div class="flex items-center gap-3">
          <Mic
            size={24}
            class={$viewMode === "smart" && $activeSmartFolder === "podcast"
              ? "text-indigo-400"
              : "text-indigo-400/70 group-hover:text-indigo-400"}
          />
          Podcasts
        </div>
        {#if $podcastCount.total > 0}
          <span
            class="text-xs font-medium {$viewMode === 'smart' &&
            $activeSmartFolder === 'podcast'
              ? 'text-white/70'
              : 'text-white/40'}"
          >
            {formatUnreadTotal($podcastCount.unread, $podcastCount.total)}
          </span>
        {/if}
      </button>

      <!-- Feeds & Folders Tree -->
      <div
        class="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-8"
      >
        Feeds & Folders
      </div>

      {#if $folders.length > 0}
        {#each $folders as folder}
          <div class="flex flex-col">
            <button
              class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
                {$viewMode === 'folder' && $activeFolderId === folder.id
                ? 'bg-white/10 text-white shadow-inner border border-white/5'
                : 'text-white/60 hover:text-white hover:bg-white/5'}"
              on:click={() => {
                setViewFolder(folder.id);
                closeMenu();
              }}
            >
              <div class="flex items-center gap-2 overflow-hidden flex-1">
                <button
                  class="p-1 -ml-1 rounded-md hover:bg-white/10 text-white/40 hover:text-white"
                  on:click={(e) => toggleFolder(e, folder.id)}
                >
                  {#if openFolders[folder.id]}
                    <ChevronDown size={14} />
                  {:else}
                    <ChevronRight size={14} />
                  {/if}
                </button>
                <FolderOpen
                  size={20}
                  class={$viewMode === "folder" && $activeFolderId === folder.id
                    ? "text-accent"
                    : "text-current group-hover:text-white"}
                />
                <span class="truncate">{folder.name}</span>
              </div>
              {#if ($folderUnreadCounts[folder.id] || 0) > 0}
                <span
                  class="text-xs font-medium bg-accent text-bg0 px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                >
                  {$folderUnreadCounts[folder.id]}
                </span>
              {/if}
            </button>

            <!-- Nested Feeds -->
            {#if openFolders[folder.id]}
              <div
                class="flex flex-col ml-3 pl-3 border-l border-white/5 mt-1 mb-1 gap-1"
              >
                {#each $feedsTree.byFolder[folder.id] || [] as feed}
                  <button
                    class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 group relative overflow-hidden
                      {$viewMode === 'feed' && $selectedFeedUrl === feed.url
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/5'}"
                    on:click={() => {
                      setViewFeed(feed.url);
                      closeMenu();
                    }}
                  >
                    <div class="flex items-center gap-3 overflow-hidden">
                      {#if feed.icon_url}
                        <img
                          src={feed.icon_url}
                          alt=""
                          class="w-4 h-4 rounded object-cover flex-shrink-0 bg-white/5"
                          on:error={(e) => {
                            const target = e.target;
                            if (target instanceof HTMLImageElement)
                              target.style.display = "none";
                          }}
                        />
                      {:else}
                        <div
                          class="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/5"
                        >
                          <Rss size={10} class="text-white/40" />
                        </div>
                      {/if}
                      <span class="truncate text-xs"
                        >{feed.title || feed.url}</span
                      >
                    </div>
                    {#if (feed.unreadCount || 0) > 0}
                      <span class="text-[10px] font-medium text-white/40">
                        {feed.unreadCount}
                      </span>
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      {/if}

      <!-- Uncategorized Feeds -->
      {#if $feedsTree.uncategorized.length > 0}
        <div
          class="mt-4 mb-2 px-3 text-xs font-semibold text-white/30 uppercase tracking-wider"
        >
          Uncategorized
        </div>
        {#each $feedsTree.uncategorized as feed}
          <button
            class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
              {$viewMode === 'feed' && $selectedFeedUrl === feed.url
              ? 'bg-white/10 text-white shadow-inner border border-white/5'
              : 'text-white/60 hover:text-white hover:bg-white/5'}"
            on:click={() => {
              setViewFeed(feed.url);
              closeMenu();
            }}
          >
            <div class="flex items-center gap-3 overflow-hidden">
              {#if feed.icon_url}
                <img
                  src={feed.icon_url}
                  alt=""
                  class="w-6 h-6 rounded-md object-cover flex-shrink-0 bg-white/5"
                  on:error={(e) => {
                    const target = e.target;
                    if (target instanceof HTMLImageElement)
                      target.style.display = "none";
                  }}
                />
              {:else}
                <div
                  class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/5"
                >
                  <Rss size={14} class="text-white/40" />
                </div>
              {/if}
              <span class="truncate">{feed.title || feed.url}</span>
            </div>
            {#if (feed.unreadCount || 0) > 0}
              <span
                class="text-xs font-medium bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
              >
                {feed.unreadCount}
              </span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>

    <!-- Settings at bottom -->
    <div class="p-4 border-t border-white/5 mt-auto">
      <button
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors w-full"
        on:click={handleSettings}
      >
        <Settings size={24} class="text-white/60" />
        <span class="text-sm font-medium text-white">Settings</span>
      </button>
    </div>
  </aside>
{/if}
