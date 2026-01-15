<script lang="ts">
  import {
    Rss,
    Edit2,
    Trash2,
    Folder as FolderIcon,
    FolderOpen,
    ChevronRight,
    ChevronDown,
  } from "lucide-svelte";
  import { feeds, removeFeed } from "$lib/stores/feeds";
  import { feedsTree } from "$lib/stores/counts";
  import { folders } from "$lib/stores/folders";
  import { renameModal, feedFolderPopover } from "$lib/stores/ui";
  import type { Feed } from "$lib/types";

  let openFolders: Record<string, boolean> = {};

  function toggleFolder(id: string) {
    if (openFolders[id]) {
      const newFolders = { ...openFolders };
      delete newFolders[id];
      openFolders = newFolders;
    } else {
      openFolders = { ...openFolders, [id]: true };
    }
  }

  function handleRenameFeed(feed: Feed) {
    renameModal.set({
      isOpen: true,
      type: "feed",
      targetId: feed.url,
      currentName: feed.title || "",
    });
  }

  function handleMoveFeed(feed: Feed, event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    feedFolderPopover.set({
      isOpen: true,
      feed: feed,
      position: { x: rect.left, y: rect.bottom + 5 },
    });
  }

  function handleDeleteFeed(feed: Feed) {
    removeFeed(feed.url);
  }

  function handleImageError(event: Event) {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = "none";
    }
  }
</script>

<div class="space-y-4">
  {#if $feeds.length === 0}
    <div class="text-center py-12 text-white/40">
      <Rss size={32} class="mx-auto mb-3 opacity-50" />
      <p>No feeds found.</p>
    </div>
  {:else}
    <div class="space-y-4">
      <!-- Folders -->
      {#each $folders as folder}
        <div class="space-y-1">
          <button
            class="flex items-center gap-2 w-full p-2 hover:bg-white/5 rounded-lg text-left transition-colors"
            on:click={() => toggleFolder(folder.id)}
          >
            {#if openFolders[folder.id]}
              <ChevronDown size={16} class="text-white/40" />
            {:else}
              <ChevronRight size={16} class="text-white/40" />
            {/if}
            <FolderOpen size={18} class="text-accent" />
            <span class="text-sm font-medium text-white">{folder.name}</span>
            <span class="text-xs text-white/40 ml-auto">
              {($feedsTree.byFolder[folder.id] || []).length} feeds
            </span>
          </button>

          {#if openFolders[folder.id]}
            <div class="ml-6 pl-2 border-l border-white/5 space-y-2">
              {#each $feedsTree.byFolder[folder.id] || [] as feed}
                <div
                  class="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                >
                  <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    {#if feed.icon_url}
                      <img src={feed.icon_url} alt="" class="w-full h-full object-cover rounded-lg" on:error={handleImageError} />
                    {:else}
                      <Rss size={14} class="text-white/40" />
                    {/if}
                  </div>

                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-white truncate">{feed.title || feed.url}</div>
                    <div class="text-xs text-white/40 truncate">{feed.url}</div>
                  </div>

                  <div class="flex items-center gap-1">
                    <button
                      class="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Move to folder"
                      on:click={(e) => handleMoveFeed(feed, e)}
                    >
                      <FolderIcon size={16} />
                    </button>
                    <button
                      class="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      title="Rename"
                      on:click={() => handleRenameFeed(feed)}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      class="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                      on:click={() => handleDeleteFeed(feed)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              {/each}
              {#if ($feedsTree.byFolder[folder.id] || []).length === 0}
                <div class="text-xs text-white/20 italic px-3 py-2">Empty folder</div>
              {/if}
            </div>
          {/if}
        </div>
      {/each}

      <!-- Uncategorized -->
      {#if $feedsTree.uncategorized.length > 0}
        <div class="space-y-2">
          {#if $folders.length > 0}
            <div class="text-xs font-semibold text-white/30 uppercase tracking-wider px-2 pt-2">Uncategorized</div>
          {/if}
          {#each $feedsTree.uncategorized as feed}
            <div
              class="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors group"
            >
              <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                {#if feed.icon_url}
                  <img src={feed.icon_url} alt="" class="w-full h-full object-cover rounded-lg" on:error={handleImageError} />
                {:else}
                  <Rss size={14} class="text-white/40" />
                {/if}
              </div>

              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-white truncate">{feed.title || feed.url}</div>
                <div class="text-xs text-white/40 truncate">{feed.url}</div>
              </div>

              <div class="flex items-center gap-1">
                <button
                  class="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Move to folder"
                  on:click={(e) => handleMoveFeed(feed, e)}
                >
                  <FolderIcon size={16} />
                </button>
                <button
                  class="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  title="Rename"
                  on:click={() => handleRenameFeed(feed)}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  class="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete"
                  on:click={() => handleDeleteFeed(feed)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
