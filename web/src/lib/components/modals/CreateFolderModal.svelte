<script lang="ts">
  import { isCreateFolderModalOpen } from "$lib/stores/ui";
  import { createFolder } from "$lib/stores/folders";
  import { toast } from "$lib/stores/toast";

  let folderName = "";
  let loading = false;
  let error: string | null = null;

  async function handleSubmit() {
    const name = folderName.trim();
    if (!name || name.length < 1 || name.length > 60) {
      error = "Folder name must be between 1 and 60 characters";
      return;
    }

    loading = true;
    error = null;

    try {
      await createFolder(name);
      close();
      toast.success("Folder created");
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to create folder";
    } finally {
      loading = false;
    }
  }

  function close() {
    isCreateFolderModalOpen.set(false);
    folderName = "";
    error = null;
  }
</script>

{#if $isCreateFolderModalOpen}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    on:click={close}
    on:keydown={(e) => e.key === "Escape" && close()}
  >
    <div
      class="folder-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-folder-title"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <div class="modal-header">
        <h2 id="create-folder-title">Create Folder</h2>
        <button class="close-btn" on:click={close}>×</button>
      </div>
      <div class="modal-body">
        <input
          type="text"
          bind:value={folderName}
          placeholder="Folder name"
          class="folder-input"
          maxlength="60"
          on:keydown={(e) => e.key === "Enter" && handleSubmit()}
          autofocus
        />
        {#if error}
          <div class="folder-error">{error}</div>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="secondary-btn" on:click={close}>Cancel</button>
        <button
          class="primary-btn"
          disabled={loading || !folderName.trim()}
          on:click={handleSubmit}
        >
          {loading ? "Creating..." : "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease;
  }

  /* Folder Modals */
  .folder-modal {
    width: 90%;
    max-width: 420px;
    padding: 0;
    animation: scaleIn 0.25s ease-out;
    background: #18181b;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: var(--radiusL);
    box-shadow: 0 40px 80px rgba(0, 0, 0, 0.8);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px;
    border-bottom: 1px solid var(--stroke);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: 1px solid var(--stroke);
    color: var(--muted);
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--panel1);
    color: var(--text);
  }

  .modal-body {
    padding: 24px;
  }

  .folder-input {
    width: 100%;
    padding: 12px 14px;
    background: var(--panel0);
    border: 1px solid var(--stroke);
    border-radius: var(--radiusM);
    color: var(--text);
    font-size: 15px;
    font-family: var(--font-ui);
    transition: all 0.2s;
  }

  .folder-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }

  .folder-error {
    margin-top: 12px;
    padding: 10px 12px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radiusM);
    color: #ef4444;
    font-size: 13px;
  }

  .modal-footer {
    display: flex;
    gap: 10px;
    padding: 24px;
    border-top: 1px solid var(--stroke);
  }

  .secondary-btn {
    flex: 1;
    padding: 12px 20px;
    background: var(--panel1);
    border: 1px solid var(--stroke);
    border-radius: var(--radiusM);
    color: var(--text);
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-ui);
    cursor: pointer;
    transition: all 0.2s;
  }

  .secondary-btn:hover {
    background: var(--panel0);
  }

  .primary-btn {
    flex: 1;
    padding: 12px 20px;
    background: var(--accent);
    border: none;
    border-radius: var(--radiusM);
    color: var(--bg0);
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font-ui);
    cursor: pointer;
    transition: all 0.2s;
  }

  .primary-btn:hover:not(:disabled) {
    background: #3fb88a;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--accent-glow);
  }

  .primary-btn:disabled {
    background: var(--panel1);
    color: var(--muted2);
    cursor: not-allowed;
    opacity: 0.5;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
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
