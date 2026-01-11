<script lang="ts">
  import { Download, Upload } from "lucide-svelte";
  import type { ImportResult } from "$lib/types";

  export let show = false;
  export let syncInterval = "off";
  export let importResults: ImportResult | null = null;
  export let importingOpml = false;

  export let onSyncIntervalChange: (interval: string) => void;
  export let onExportOpml: () => void;
  export let onImportOpml: (file: File) => void;
  export let onClose: () => void;

  const validIntervals = [
    "off",
    "15m",
    "30m",
    "1h",
    "4h",
    "8h",
    "12h",
    "24h",
  ] as const;

  function handleSyncIntervalChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    onSyncIntervalChange(select.value);
  }

  function handleFileImport(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      onImportOpml(input.files[0]);
    }
  }
</script>

{#if show}
  <div
    class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    role="button"
    tabindex="0"
    on:click={onClose}
    on:keydown={(e) => e.key === "Escape" && onClose()}
  >
    u003cdiv
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      class="w-full max-w-lg overflow-hidden glass rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200"
      on:click|stopPropagation
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5"
      >
        <h2 id="settings-title" class="text-lg font-semibold text-white">Settings</h2>
        <button
          class="text-white/40 hover:text-white transition-colors"
          on:click={onClose}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 5l10 10M15 5l-10 10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-6">
        <!-- Sync Section -->
        <div class="space-y-3">
          <h3
            class="text-sm font-medium text-white/60 uppercase tracking-wider"
          >
            Automatic Sync
          </h3>
          <div class="relative">
            <select
              class="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white appearance-none focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
              value={syncInterval}
              on:change={handleSyncIntervalChange}
            >
              {#each validIntervals as interval}
                <option value={interval} class="bg-surface text-white">
                  {interval === "off" ? "Off" : `Every ${interval}`}
                </option>
              {/each}
            </select>
            <div
              class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-white/40"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 4L6 8L10 4"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <!-- OPML Section -->
        <div class="space-y-3">
          <h3
            class="text-sm font-medium text-white/60 uppercase tracking-wider"
          >
            OPML Management
          </h3>
          <div class="grid grid-cols-2 gap-3">
            <button
              class="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white transition-all hover:scale-[1.02]"
              on:click={onExportOpml}
            >
              <Download size={18} />
              <span>Export</span>
            </button>

            <label
              class="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-white transition-all hover:scale-[1.02] cursor-pointer"
            >
              <Upload size={18} />
              <span>{importingOpml ? "Importing..." : "Import"}</span>
              <input
                type="file"
                accept=".opml,.xml"
                on:change={handleFileImport}
                disabled={importingOpml}
                class="hidden"
              />
            </label>
          </div>

          <!-- Import Results -->
          {#if importResults}
            <div
              class="mt-4 p-4 rounded-xl bg-black/20 border border-white/10 text-sm"
            >
              <div class="flex gap-4 mb-2">
                <span class="text-green-400"
                  >✓ Added: {importResults.added}</span
                >
                <span class="text-yellow-400"
                  >⊘ Skipped: {importResults.skipped}</span
                >
                {#if importResults.failed.length > 0}
                  <span class="text-red-400"
                    >✗ Failed: {importResults.failed.length}</span
                  >
                {/if}
              </div>
              {#if importResults.failed.length > 0}
                <div class="mt-2 space-y-1 max-h-32 overflow-y-auto">
                  {#each importResults.failed as fail}
                    <div class="text-xs text-red-400/80 break-all">
                      {fail.url}: {fail.error}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
