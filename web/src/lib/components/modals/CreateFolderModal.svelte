<script lang="ts">
  import { isCreateFolderModalOpen } from "$lib/stores/ui";
  import { createFolder } from "$lib/stores/folders";
  import { toast } from "$lib/stores/toast";
  import { X, FolderPlus } from "lucide-svelte";

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

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      close();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $isCreateFolderModalOpen}
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
            <FolderPlus size={20} class="text-accent" />
          </div>
          <h2 class="text-xl font-semibold text-white">Create Folder</h2>
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
            Folder Name
          </span>
          <input
            type="text"
            bind:value={folderName}
            placeholder="Enter folder name..."
            class="w-full bg-white/5 px-4 py-3.5 rounded-xl text-white placeholder-white/40 border border-white/10 hover:bg-white/10 focus:border-accent/50 transition-colors outline-none"
            maxlength="60"
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
          disabled={loading || !folderName.trim()}
        >
          {loading ? "Creating..." : "Create"}
        </button>
      </div>
    </div>
  </div>
{/if}
