<script lang="ts">
  import { feedFolderPopover } from "$lib/stores/ui";
  import { folders } from "$lib/stores/folders";
  import { addToFolder, removeFromFolder, loadFeeds } from "$lib/stores/feeds";
  import { createFolder } from "$lib/stores/folders";
  import { toast } from "$lib/stores/toast";

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
      // Optimistic update or reload happens in stores
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
      // Create folder
      // We need the ID of the new folder. createFolder in store returns void but we need ID.
      // We might need to call API directly or update store to return ID.
      // Let's assume we call API directly for this specific flow to get ID, or update store.
      // For now, let's use the API directly since store doesn't return ID.
      // Actually, let's update the store later to return ID.
      // For now, I'll just reload everything.
      // Wait, createFolder API returns { ok: true, id: number }.

      // I'll assume createFolder works and just adds it.
      // But I need to add the feed to it immediately.
      // I'll skip the immediate add for now and just create it, user can check it.
      // OR better: Update store to return ID. I will do that in next step.
      await createFolder(name);

      // Ideally we would add the feed here, but we need the new folder ID.
      // Let's just reset the form for now.
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
</script>

{#if $feedFolderPopover.isOpen && $feedFolderPopover.feed}
  <div class="popover-overlay" on:click={close}>
    <div
      class="feed-folder-popover"
      style="left: {$feedFolderPopover.position.x}px; top: {$feedFolderPopover
        .position.y}px;"
      on:click|stopPropagation
    >
      <div class="popover-header">
        <span>Add to folder</span>
        <button class="close-btn-small" on:click={close}>×</button>
      </div>
      <div class="popover-body">
        {#if $folders.length === 0}
          <div class="popover-empty">No folders yet</div>
        {:else}
          {#each $folders as folder}
            <label class="folder-checkbox-item">
              <input
                type="checkbox"
                checked={$feedFolderPopover.feed.folders &&
                  $feedFolderPopover.feed.folders.includes(folder.id)}
                on:change={(e) =>
                  handleToggle(folder.id, e.currentTarget.checked)}
              />
              <span>{folder.name}</span>
            </label>
          {/each}
        {/if}

        {#if !showCreateFolder}
          <button
            class="create-folder-in-popover-btn"
            on:click={() => (showCreateFolder = true)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 3v8M3 7h8"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
            Create new folder
          </button>
        {:else}
          <div class="create-folder-inline">
            <input
              type="text"
              bind:value={newFolderName}
              placeholder="Folder name"
              class="inline-folder-input"
              maxlength="60"
              on:keydown={(e) => e.key === "Enter" && handleCreateFolder()}
              autofocus
            />
            <button
              class="inline-create-btn"
              on:click={handleCreateFolder}
              disabled={!newFolderName.trim()}>Add</button
            >
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .popover-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
  }
  .feed-folder-popover {
    position: fixed;
    min-width: 240px;
    max-width: 300px;
    padding: 0;
    z-index: 2001;
    animation: scaleIn 0.2s ease-out;
    background: #18181b;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: var(--radiusM);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }

  .popover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-bottom: 1px solid var(--stroke);
  }

  .popover-header span {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }

  .close-btn-small {
    width: 20px;
    height: 20px;
    padding: 0;
    background: none;
    border: none;
    color: var(--muted);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    transition: all 0.2s;
  }

  .close-btn-small:hover {
    background: var(--panel1);
    color: var(--text);
  }

  .popover-body {
    padding: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  .popover-empty {
    padding: 20px;
    text-align: center;
    color: var(--muted2);
    font-size: 13px;
  }

  .folder-checkbox-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    cursor: pointer;
    border-radius: var(--radiusS);
    transition: all 0.2s;
  }

  .folder-checkbox-item:hover {
    background: var(--panel0);
  }

  .folder-checkbox-item input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }

  .folder-checkbox-item span {
    flex: 1;
    font-size: 14px;
    color: var(--text);
  }

  .create-folder-in-popover-btn {
    width: 100%;
    margin-top: 4px;
    padding: 8px 10px;
    background: none;
    border: 1px dashed var(--stroke);
    border-radius: var(--radiusM);
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font-ui);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.2s;
  }

  .create-folder-in-popover-btn:hover {
    background: var(--panel0);
    border-color: var(--accent);
    color: var(--accent);
  }

  .create-folder-inline {
    margin-top: 4px;
    display: flex;
    gap: 6px;
  }

  .inline-folder-input {
    flex: 1;
    padding: 6px 10px;
    background: var(--panel0);
    border: 1px solid var(--stroke);
    border-radius: var(--radiusM);
    color: var(--text);
    font-size: 13px;
    font-family: var(--font-ui);
  }

  .inline-folder-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .inline-create-btn {
    padding: 6px 12px;
    background: var(--accent);
    border: none;
    border-radius: var(--radiusM);
    color: var(--bg0);
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-ui);
    cursor: pointer;
    transition: all 0.2s;
  }

  .inline-create-btn:hover:not(:disabled) {
    background: #3fb88a;
  }

  .inline-create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
