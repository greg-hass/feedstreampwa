<script lang="ts">
  import { tick } from "svelte";
  import {
    FolderOpen,
    Plus,
    ChevronRight,
    ChevronDown,
    MoreVertical,
    Rss,
  } from "lucide-svelte";
  import {
    viewMode,
    activeFolderId,
    selectedFeedUrl,
    setViewFolder,
    setViewFeed,
    contextMenu,
  } from "$lib/stores/ui";
  import {
    feedsTree,
    folderUnreadCounts,
  } from "$lib/stores/counts";
  import { folders, createFolder } from "$lib/stores/folders";
  import { toast } from "$lib/stores/toast";
  import type { Feed, Folder } from "$lib/types";

  export let openFolders: Record<string, boolean> = {};
  export let isCreatingInline = false;
  export let inlineFolderName = "";
  export let isSubmitting = false;
  let inlineInputEl: HTMLInputElement | null = null;
  let wasCreatingInline = false;

  $: if (isCreatingInline && !wasCreatingInline) {
    wasCreatingInline = true;
    tick().then(() => inlineInputEl?.focus());
  } else if (!isCreatingInline) {
    wasCreatingInline = false;
  }

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

  function handleContextMenu(
    e: MouseEvent,
    type: "folder" | "feed",
    target: Feed | Folder
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

<div class="space-y-1 mt-6">
  <div class="flex items-center justify-between px-3 mb-3">
    <div
      class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-200 uppercase tracking-[0.22em]"
    >
      <span class="h-1.5 w-1.5 rounded-full bg-amber-300/80"></span>
      Feeds & Folders
    </div>
    <button
      class="text-white/40 hover:text-white transition-colors"
      on:click={() => (isCreatingInline = true)}
      title="New folder (Shift + N)"
    >
      <Plus size={14} />
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
        bind:this={inlineInputEl}
        placeholder="Folder name..."
        class="w-full bg-raised border border-accent/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-accent shadow-[0_0_10px_rgba(16,185,129,0.1)]"
        on:keydown={(e) => e.key === "Enter" && handleInlineSubmit()}
        on:blur={() => !inlineFolderName && (isCreatingInline = false)}
      />
    </div>
  {/if}

  <!-- Folders -->
  {#if $folders.length > 0}
    {#each $folders as folder}
      <div class="flex flex-col">
        <button
          class="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
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
            {#if ($feedsTree.byFolder[folder.id] || []).length === 0}
              <div class="px-3 py-2 text-xs text-white/20 italic">
                Empty folder
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  {/if}

  <!-- Uncategorized Feeds -->
  {#if $feedsTree.uncategorized.length > 0}
    <div
      class="mt-4 mb-2 px-3 text-[11px] font-semibold text-white/40 uppercase tracking-[0.22em]"
    >
      Uncategorized
    </div>
    {#each $feedsTree.uncategorized as feed}
      <button
        class="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
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
