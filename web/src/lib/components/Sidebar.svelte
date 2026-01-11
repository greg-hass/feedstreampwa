<script lang="ts">
  import { page } from "$app/stores";
  import {
    LayoutDashboard,
    List,
    Bookmark,
    Circle,
    Settings,
    PlusCircle,
    Rss,
    Youtube,
    MessageCircle,
    Mic,
    FolderOpen,
    Plus,
    ChevronRight,
    ChevronDown,
  } from "lucide-svelte";
  import {
    isAddFeedModalOpen,
    isSettingsModalOpen,
    isCreateFolderModalOpen,
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
    feedsTree,
    folderUnreadCounts,
  } from "$lib/stores/counts";
  import { folders, createFolder } from "$lib/stores/folders";
  import { feeds } from "$lib/stores/feeds";
  import { toast } from "$lib/stores/toast";

  // Navigation Items
  const navItems = [
    { label: "Feeds", icon: List, href: "/feeds", countStore: totalFeeds },
    { label: "Library", icon: Bookmark, href: "/library", countStore: libraryTotal },
  ];

  $: activeUrl = $page.url.pathname;

  let openFolders: Record<string, boolean> = {};
  let isCreatingInline = false;
  let inlineFolderName = "";
  let isSubmitting = false;

  function toggleFolder(e: MouseEvent, id: string) {
    e.stopPropagation();
    openFolders[id] = !openFolders[id];
  }

  async function handleInlineSubmit() {
    const name = inlineFolderName.trim();
    if (!name || isSubmitting) return;

    isSubmitting = true;
    try {
      await createFolder(name);
      inlineFolderName = "";
      isCreatingInline = false;
      toast.success(`Folder "${name}" created`);
    } catch (err) {
      toast.error("Failed to create folder");
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && isCreatingInline) {
      isCreatingInline = false;
      inlineFolderName = "";
    }
    
    // Global Shortcut: Shift + N for new folder
    if (e.shiftKey && e.key === "N" && !isCreatingInline) {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
        e.preventDefault();
        isCreatingInline = true;
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<aside
  class="hidden md:flex flex-col w-[280px] h-screen fixed left-0 top-0 z-40 bg-background border-r border-white/5"
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

    <!-- Unread -->
    <button
      class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
        {$viewMode === 'unread'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      on:click={setViewUnread}
    >
      <div class="flex items-center gap-3">
        <Circle
          size={24}
          class={$viewMode === 'unread'
            ? "text-blue-400"
            : "text-current group-hover:text-white"}
          fill={$viewMode === 'unread' ? "currentColor" : "none"}
        />
        Unread
      </div>

      {#if $allArticlesUnread > 0}
        <span class="text-xs font-medium {$viewMode === 'unread' ? 'text-white/70' : 'text-white/40'}">
          {$allArticlesUnread}
        </span>
      {/if}

      {#if $viewMode === 'unread'}
        <div
          class="absolute inset-y-0 left-0 w-1 bg-blue-400 rounded-r-full shadow-[0_0_10px_2px_rgba(96,165,250,0.5)]"
        ></div>
      {/if}
    </button>

    <!-- Bookmarks (formerly Library) -->
    <button
      class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
        {$viewMode === 'bookmarks'
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      on:click={setViewBookmarks}
    >
      <div class="flex items-center gap-3">
        <Bookmark
          size={24}
          class={$viewMode === 'bookmarks'
            ? "text-[#FF9500]"
            : "text-current group-hover:text-white"}
          fill={$viewMode === 'bookmarks' ? "currentColor" : "none"}
        />
        Bookmarks
      </div>

      {#if $libraryTotal > 0}
        <span class="text-xs font-medium {$viewMode === 'bookmarks' ? 'text-white/70' : 'text-white/40'}">
          {$libraryTotal}
        </span>
      {/if}

      {#if $viewMode === 'bookmarks'}
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

    <!-- Folders & Feeds Tree -->
    <div class="flex items-center justify-between px-3 mb-2 mt-8">
      <div class="text-xs font-semibold text-white/40 uppercase tracking-wider">
        Feeds & Folders
      </div>
      <button
        class="text-white/40 hover:text-white transition-colors"
        on:click={() => isCreatingInline = true}
        title="New folder (Shift + N)"
      >
        <Plus size={14} />
      </button>
    </div>

    <!-- Inline Quick Create -->
    {#if isCreatingInline}
      <div class="px-3 mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
        <input
          type="text"
          bind:value={inlineFolderName}
          placeholder="Folder name..."
          class="w-full bg-raised border border-accent/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent shadow-[0_0_10px_rgba(16,185,129,0.1)]"
          on:keydown={(e) => e.key === "Enter" && handleInlineSubmit()}
          on:blur={() => !inlineFolderName && (isCreatingInline = false)}
          autofocus
        />
      </div>
    {/if}

    <!-- Folders -->
    {#if $folders.length > 0}
      {#each $folders as folder}
        <div class="flex flex-col">
          <button
            class="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
              {$viewMode === 'folder' && $activeFolderId === folder.id
                ? 'bg-white/10 text-white shadow-inner border border-white/5'
                : 'text-white/60 hover:text-white hover:bg-white/5'}"
            on:click={() => setViewFolder(folder.id)}
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
                class={$viewMode === 'folder' && $activeFolderId === folder.id
                  ? 'text-accent'
                  : 'text-current group-hover:text-white'}
              />
              <span class="truncate">{folder.name}</span>
            </div>

            {#if ($folderUnreadCounts[folder.id] || 0) > 0}
              <span class="text-xs font-medium bg-accent text-bg0 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {$folderUnreadCounts[folder.id]}
              </span>
            {/if}

            {#if $viewMode === 'folder' && $activeFolderId === folder.id}
              <div
                class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
              ></div>
            {/if}
          </button>

          <!-- Nested Feeds -->
          {#if openFolders[folder.id]}
            <div class="flex flex-col ml-3 pl-3 border-l border-white/5 mt-1 mb-1 gap-1">
              {#each $feedsTree.byFolder[folder.id] || [] as feed}
                <button
                  class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 group relative overflow-hidden
                    {$viewMode === 'feed' && $selectedFeedUrl === feed.url
                      ? 'bg-white/10 text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/5'}"
                  on:click={() => setViewFeed(feed.url)}
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
                      <div class="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/5">
                        <Rss size={10} class="text-white/40" />
                      </div>
                    {/if}
                    <span class="truncate text-xs">{feed.title || feed.url}</span>
                  </div>

                  {#if (feed.unreadCount || 0) > 0}
                    <span class="text-[10px] font-medium text-white/40">
                      {feed.unreadCount}
                    </span>
                  {/if}
                </button>
              {/each}
              {#if ($feedsTree.byFolder[folder.id] || []).length === 0}
                <div class="px-3 py-2 text-xs text-white/20 italic">Empty folder</div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    {/if}

    <!-- Uncategorized Feeds -->
    {#if $feedsTree.uncategorized.length > 0}
      <div class="mt-4 mb-2 px-3 text-xs font-semibold text-white/30 uppercase tracking-wider">
        Uncategorized
      </div>
      {#each $feedsTree.uncategorized as feed}
        <button
          class="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
            {$viewMode === 'feed' && $selectedFeedUrl === feed.url
              ? 'bg-white/10 text-white shadow-inner border border-white/5'
              : 'text-white/60 hover:text-white hover:bg-white/5'}"
          on:click={() => setViewFeed(feed.url)}
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
              <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/5">
                <Rss size={14} class="text-white/40" />
              </div>
            {/if}
            <span class="truncate">{feed.title || feed.url}</span>
          </div>

          {#if (feed.unreadCount || 0) > 0}
            <span class="text-xs font-medium bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {feed.unreadCount}
            </span>
          {/if}

          {#if $viewMode === 'feed' && $selectedFeedUrl === feed.url}
            <div
              class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
            ></div>
          {/if}
        </button>
      {/each}
    {/if}
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
