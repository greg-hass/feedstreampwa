<script lang="ts">
  import { renameModal } from "$lib/stores/ui";
  import { renameFolder } from "$lib/stores/folders";
  import * as feedsApi from "$lib/api/feeds";
  import { toast } from "$lib/stores/toast";
  import { loadFeeds } from "$lib/stores/feeds";
  import { X, Edit2, FolderOpen } from "lucide-svelte";

  let newName = "";
  let loading = false;
  let error: string | null = null;

  $: if ($renameModal.isOpen) {
    newName = $renameModal.currentName;
    error = null;
  }

  async function handleSubmit() {
    const name = newName.trim();
    if (!name || name.length < 1 || name.length > 100) {
      error = "Name must be between 1 and 100 characters";
      return;
    }

    loading = true;
    error = null;

    try {
      if ($renameModal.type === "folder") {
        await renameFolder($renameModal.targetId, name);
        toast.success("Folder renamed");
      } else {
        await feedsApi.update($renameModal.targetId, { title: name });
        await loadFeeds();
        toast.success("Feed renamed");
      }
      close();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to rename";
    } finally {
      loading = false;
    }
  }

  function close() {
    renameModal.update((s) => ({ ...s, isOpen: false }));
    newName = "";
    error = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $renameModal.isOpen}
  <div
    class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
    on:click={close}
    on:keydown={(e) => e.key === "Enter" && close()}
    role="button"
    tabindex="-1"
  >
    <div
      class="bg-[#18181b] rounded-2xl border border-accent/20 max-w-md w-full flex flex-col shadow-2xl overflow-hidden"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="bg-[#18181b] rounded-t-2xl border-b border-white/10 px-6 py-4 flex items-center justify-between flex-shrink-0"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/20 flex items-center justify-center"
          >
            {#if $renameModal.type === "folder"}
              <FolderOpen size={20} class="text-accent" />
            {:else}
              <Edit2 size={20} class="text-accent" />
            {/if}
          </div>
          <h2 class="text-xl font-semibold text-white">
            Rename {$renameModal.type === "feed" ? "Feed" : "Folder"}
          </h2>
        </div>
        <button
          class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          on:click={close}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4">
        <label class="block">
          <span
            class="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 block"
          >
            New Name
          </span>
          <input
            type="text"
            bind:value={newName}
            placeholder="Enter new name..."
            class="w-full bg-white/5 px-4 py-3.5 rounded-xl text-white placeholder-white/40 border border-white/10 hover:bg-white/10 focus:border-accent/50 transition-colors outline-none"
            maxlength="100"
            on:keydown={(e) => e.key === "Enter" && handleSubmit()}
            autofocus
          />
        </label>

        {#if error}
          <div
            class="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            {error}
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div
        class="sticky bottom-0 bg-[#18181b] border-t border-white/10 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl"
      >
        <button
          class="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
          on:click={close}
          disabled={loading}
        >
          Cancel
        </button>
        <button
          class="px-6 py-2 rounded-xl bg-accent text-white hover:brightness-110 transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
          on:click={handleSubmit}
          disabled={loading || !newName.trim()}
        >
          {loading ? "Renaming..." : "Rename"}
        </button>
      </div>
    </div>
  </div>
{/if}
