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
    Eye,
    Hash,
    Settings,
    Rss,
    Youtube,
    Mic,
    FolderOpen,
    ChevronRight,
    ChevronDown,
    Sparkles,
    Activity,
    Copy,
    Plus,
    MoreVertical,
  } from "lucide-svelte";
  import RedditIcon from "./icons/RedditIcon.svelte";
  import {
    isMobileMenuOpen,
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
    contextMenu,
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
    allArticlesTotal,
  } from "$lib/stores/counts";
  import { folders, createFolder } from "$lib/stores/folders";
  import { toast } from "$lib/stores/toast";

  import AIRecommendationsModal from "$lib/components/modals/AIRecommendationsModal.svelte";
  import FeedHealthModal from "$lib/components/modals/FeedHealthModal.svelte";
  import DuplicatesModal from "$lib/components/modals/DuplicatesModal.svelte";

  $: activeUrl = $page.url.pathname;

  let openFolders: Record<string, boolean> = {};
  let isCreatingInline = false;
  let inlineFolderName = "";
  let isSubmitting = false;

  let isAIRecommendationsOpen = false;
  let isFeedHealthOpen = false;
  let isDuplicatesOpen = false;

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
    if (e.key === "Escape") {
      if ($isMobileMenuOpen) closeMenu();
      if (isCreatingInline) {
        isCreatingInline = false;
        inlineFolderName = "";
      }
    }
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

  function handleContextMenu(
    e: MouseEvent,
    type: "folder" | "feed",
    target: any
  ) {
    e.preventDefault();
    e.stopPropagation();

    contextMenu.set({
      isOpen: true,
      type,
      target,
      position: { x: e.clientX, y: e.clientY },
    });
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
    class="fixed left-0 top-0 h-full w-[280px] bg-[#121212] border-r border-white/10 z-[70] md:hidden flex flex-col shadow-2xl"
    transition:fly={{ x: -280, duration: 300, opacity: 1 }}
  >
    <!-- Header -->
    <div class="p-6 pt-8 flex items-center justify-between flex-shrink-0">
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

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto scrollbar-hide px-4 py-2 space-y-1">
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
        {#if $allArticlesUnread > 0}
          <span
            class="text-xs font-medium {$viewMode === 'all'
              ? 'text-white/70'
              : 'text-white/40'}"
          >
            {formatUnreadTotal($allArticlesUnread, $allArticlesTotal)}
          </span>
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
          <Eye
            size={24}
            class={$viewMode === "unread"
              ? "text-blue-400"
              : "text-current group-hover:text-white"}
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
              ? "text-emerald-400"
              : "text-emerald-400/70 group-hover:text-emerald-400"}
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
          <Hash
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
      <div class="flex items-center justify-between px-3 mb-2 mt-8">
        <div
          class="text-xs font-semibold text-white/40 uppercase tracking-wider"
        >
          Feeds & Folders
        </div>
        <button
          class="text-white/40 hover:text-white transition-colors"
          on:click={() => (isCreatingInline = true)}
          title="New folder"
        >
          <Plus size={16} />
        </button>
      </div>

      <!-- Inline Quick Create -->
      {#if isCreatingInline}
        <div
          class="px-3 mb-2 animate-in fade-in slide-in-from-top-1 duration-200"
        >
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
              <div class="flex items-center gap-2">
                <button
                  class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                  on:click={(e) => handleContextMenu(e, "folder", folder)}
                  title="Folder Options"
                >
                  <MoreVertical size={14} />
                </button>
                {#if ($folderUnreadCounts[folder.id] || 0) > 0}
                  <span
                    class="text-xs font-medium bg-accent text-bg0 px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                  >
                    {$folderUnreadCounts[folder.id]}
                  </span>
                {/if}
              </div>
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
                    <div class="flex items-center gap-1">
                      <button
                        class="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                        on:click={(e) => handleContextMenu(e, "feed", feed)}
                        title="Feed Options"
                      >
                        <MoreVertical size={12} />
                      </button>
                      {#if (feed.unreadCount || 0) > 0}
                        <span class="text-[10px] font-medium text-white/40">
                          {feed.unreadCount}
                        </span>
                      {/if}
                    </div>
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
            <div class="flex items-center gap-1">
              <button
                class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                on:click={(e) => handleContextMenu(e, "feed", feed)}
                title="Feed Options"
              >
                <MoreVertical size={14} />
              </button>
              {#if (feed.unreadCount || 0) > 0}
                <span
                  class="text-xs font-medium bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
                >
                  {feed.unreadCount}
                </span>
              {/if}
            </div>
          </button>
        {/each}
      {/if}
    </div>

    <!-- AI Recommendations, Feed Health, Duplicates & Settings -->
    <div
      class="flex-shrink-0 p-4 border-t border-white/5 bg-[#121212] space-y-2"
    >
      <!-- AI Recommendations -->
      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:from-purple-500/20 hover:to-pink-500/20 transition-all text-white group"
        on:click={() => {
          closeMenu();
          isAIRecommendationsOpen = true;
        }}
      >
        <Sparkles
          size={24}
          class="text-purple-400 group-hover:text-purple-300"
        />
        <span class="text-sm font-semibold">AI Recommendations</span>
      </button>

      <!-- Feed Health -->
      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white"
        on:click={() => {
          closeMenu();
          isFeedHealthOpen = true;
        }}
      >
        <Activity size={24} />
        <span class="text-sm font-medium">Feed Health</span>
      </button>

      <!-- Duplicates -->
      <button
        class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white"
        on:click={() => {
          closeMenu();
          isDuplicatesOpen = true;
        }}
      >
        <Copy size={24} class="text-orange-400 group-hover:text-orange-300" />
        <span class="text-sm font-medium">Duplicates</span>
      </button>

      <!-- Settings -->
      <button
        class="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors w-full text-white/60 hover:text-white"
        on:click={handleSettings}
      >
        <Settings size={24} />
        <span class="text-sm font-medium">Settings</span>
      </button>
    </div>
  </aside>

  <!-- Modals (Only render when menu is open/active to keep DOM light, or keep persistent if needed) -->
  <AIRecommendationsModal
    bind:isOpen={isAIRecommendationsOpen}
    on:close={() => (isAIRecommendationsOpen = false)}
  />

  <FeedHealthModal bind:isOpen={isFeedHealthOpen} />

  <DuplicatesModal bind:isOpen={isDuplicatesOpen} />
{/if}
