<script lang="ts">
  import { feedFolderPopover } from "$lib/stores/ui";
  import { folders } from "$lib/stores/folders";
  import { addToFolder, removeFromFolder } from "$lib/stores/feeds";
  import { createFolder } from "$lib/stores/folders";
  import { toast } from "$lib/stores/toast";
  import { X, FolderPlus, Plus } from "lucide-svelte";

  let showCreateFolder = false;
  let newFolderName = "";

  async function handleToggle(folderId: string, isChecked: boolean) {
    if (!$feedFolderPopover.feed) return;
    const feedUrl = $feedFolderPopover.feed.url;

    try {
      if (isChecked) {
        await addToFolder(feedUrl, folderId);
      } else {
        await removeFromFolder(feedUrl, folderId);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update folder"
      );
    }
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name || !$feedFolderPopover.feed) return;

    try {
      await createFolder(name);
      newFolderName = "";
      showCreateFolder = false;
      toast.success("Folder created. Check the box to add feed.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create folder"
      );
    }
  }

  function close() {
    feedFolderPopover.update((s) => ({ ...s, isOpen: false }));
    showCreateFolder = false;
    newFolderName = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    }
  }
</script>

  let windowWidth: number;
  let windowHeight: number;
  let boxWidth: number;
  let boxHeight: number;

  $: constrainedX = (() => {
    if (!windowWidth || !boxWidth) return $feedFolderPopover.position.x;
    return Math.min($feedFolderPopover.position.x, windowWidth - boxWidth - 16);
  })();

  $: constrainedY = (() => {
    if (!windowHeight || !boxHeight) return $feedFolderPopover.position.y;
    // Check if it fits below, otherwise flip to above? 
    // For now, just ensuring it doesn't go off screen bottom
    return Math.min($feedFolderPopover.position.y, windowHeight - boxHeight - 16);
  })();
</script>

<svelte:window on:keydown={handleKeydown} bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

{#if $feedFolderPopover.isOpen && $feedFolderPopover.feed}
  <div
    class="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 md:bg-transparent md:z-[2000]"
    on:click={close}
    on:keydown={(e) => e.key === "Enter" && close()}
    role="button"
    tabindex="-1"
  >
    <div
      bind:clientWidth={boxWidth}
      bind:clientHeight={boxHeight}
      class="bg-[#18181b] rounded-2xl border border-white/10 w-full max-w-sm flex flex-col shadow-2xl overflow-hidden fixed"
      style="left: {constrainedX}px; top: {constrainedY}px;"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="bg-[#18181b] rounded-t-2xl border-b border-white/10 px-4 py-3 flex items-center justify-between flex-shrink-0"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/20 flex items-center justify-center"
          >
            <FolderPlus size={16} class="text-accent" />
          </div>
          <h2 class="text-base font-semibold text-white">Add to folder</h2>
        </div>
        <button
          class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          on:click={close}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <!-- Body -->
      <div class="p-3 max-h-[400px] overflow-y-auto">
        {#if $folders.length === 0}
          <div class="text-center py-8 text-white/40 text-sm">
            No folders yet
          </div>
        {:else}
          <div class="space-y-1">
            {#each $folders as folder}
              <label
                class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
              >
                <input
                  type="checkbox"
                  checked={$feedFolderPopover.feed.folders &&
                    $feedFolderPopover.feed.folders.includes(folder.id)}
                  on:change={(e) =>
                    handleToggle(folder.id, e.currentTarget.checked)}
                  class="w-4 h-4 rounded border-white/20 bg-white/5 text-accent focus:ring-2 focus:ring-accent/50 focus:ring-offset-0 cursor-pointer"
                />
                <span class="flex-1 text-sm text-white font-medium">
                  {folder.name}
                </span>
              </label>
            {/each}
          </div>
        {/if}

        <!-- Create Folder Section -->
        <div class="mt-3 pt-3 border-t border-white/5">
          {#if !showCreateFolder}
            <button
              class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/20 hover:border-accent/50 hover:bg-accent/5 text-white/60 hover:text-accent transition-all text-sm font-medium"
              on:click={() => (showCreateFolder = true)}
            >
              <Plus size={16} />
              Create new folder
            </button>
          {:else}
            <div class="flex gap-2">
              <input
                type="text"
                bind:value={newFolderName}
                placeholder="Folder name"
                class="flex-1 bg-white/5 px-3 py-2 rounded-lg text-white placeholder-white/40 border border-white/10 focus:border-accent/50 transition-colors outline-none text-sm"
                maxlength="60"
                on:keydown={(e) => e.key === "Enter" && handleCreateFolder()}
                autofocus
              />
              <button
                class="px-4 py-2 rounded-lg bg-accent text-white hover:brightness-110 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                on:click={handleCreateFolder}
                disabled={!newFolderName.trim()}
              >
                Add
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Mobile: Center the modal */
  @media (max-width: 768px) {
    div[style*="left:"] {
      left: 50% !important;
      top: 50% !important;
      transform: translate(-50%, -50%) !important;
    }
  }
</style>
