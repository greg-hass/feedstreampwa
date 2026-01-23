<script lang="ts">
  import { contextMenu, renameModal, feedFolderPopover } from "$lib/stores/ui";
  import { deleteFolder } from "$lib/stores/folders";
  import { removeFeed } from "$lib/stores/feeds";
  import type { Feed, Folder } from "$lib/types";

  function close() {
    contextMenu.update((s: any) => ({ ...s, isOpen: false }));
  }

  function handleRename() {
    const { type, target } = $contextMenu;
    if (!target) return;

    let targetId = "";
    let currentName = "";

    if (type === "folder") {
      const folder = target as Folder;
      targetId = folder.id;
      currentName = folder.name;
    } else {
      const feed = target as Feed;
      targetId = feed.url;
      currentName = feed.title || "";
    }

    renameModal.set({
      isOpen: true,
      type,
      targetId,
      currentName,
    });
    close();
  }

  function handleMove(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    handleMoveFromRect(rect);
  }

  function handleMoveFromRect(rect: DOMRect) {
    const { target, type } = $contextMenu;
    if (type !== "feed" || !target) return;

    feedFolderPopover.set({
      isOpen: true,
      feed: target as Feed,
      position: { x: rect.right + 5, y: rect.top },
    });
    close();
  }

  function handleMoveToFolder(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    handleMoveFromRect(rect);
  }

  function handleDelete() {
    const { type, target } = $contextMenu;
    if (!target) return;

    if (type === "folder") {
      deleteFolder((target as Folder).id);
    } else {
      removeFeed((target as Feed).url);
    }
    close();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.currentTarget !== event.target) return;
    close();
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      close();
    }
  }
</script>

{#if $contextMenu.isOpen}
  <div
    class="modal-overlay"
    on:click={handleBackdropClick}
    on:keydown={handleBackdropKeydown}
    role="button"
    aria-label="Close menu"
    tabindex="0"
  >
    <div
      class="context-menu glass-panel"
      style="left: {$contextMenu.position.x}px; top: {$contextMenu.position
        .y}px;"
      role="menu"
      tabindex="-1"
    >
      <button class="menu-item" on:click={handleRename}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M10 1l3 3-7 7H3v-3l7-7z"
            stroke="currentColor"
            stroke-width="1.5"
            fill="none"
          />
        </svg>
        Rename
      </button>

      {#if $contextMenu.type === "feed"}
        <button class="menu-item" on:click|stopPropagation={handleMoveToFolder}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 4h5l1 2h8v10H2V4z"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
              fill="none"
            />
          </svg>
          Move to Folder
        </button>
      {/if}

      <button class="menu-item danger" on:click={handleDelete}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M2 4h10M5 4V2h4v2M4 4v8h6V4"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        Delete
      </button>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 2999;
  }

  .context-menu {
    position: fixed;
    min-width: 180px;
    background: #16161a;
    border: 1px solid var(--stroke);
    border-radius: var(--radiusM);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    padding: 6px;
    z-index: 3000;
    animation: scaleIn 0.15s ease-out;
  }

  .menu-item {
    width: 100%;
    padding: 10px 14px;
    background: none;
    border: none;
    color: var(--text);
    font-size: 13px;
    font-family: var(--font-ui);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    text-align: left;
    border-radius: var(--radiusS);
  }

  .menu-item:hover {
    background: var(--panel0);
  }

  .menu-item.danger {
    color: #ef4444;
  }

  .menu-item.danger:hover {
    background: rgba(239, 68, 68, 0.1);
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
