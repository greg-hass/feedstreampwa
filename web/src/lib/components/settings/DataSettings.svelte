<script lang="ts">
  import { Download, Upload, Database, Loader2, List, Settings as SettingsIcon } from "lucide-svelte";
  import { loadFeeds } from "$lib/stores/feeds";
  import { loadFolders } from "$lib/stores/folders";
  import type { ImportResult, ImportStatus, Backup } from "$lib/types";

  export let importingOpml = false;
  export let importStatus: ImportStatus | null = null;
  export let importResults: ImportResult | null = null;
  export let backups: Backup[] = [];
  export let backupLoading = false;
  export let handleCreateBackup: () => Promise<void>;
  export let handleExportOpml: () => Promise<void>;
  export let handleImportOpml: (event: Event) => Promise<void>;
</script>

<div class="space-y-6">
  <div class="space-y-3">
    <h3 class="text-sm font-semibold text-white uppercase tracking-wider">OPML Import / Export</h3>
    <div class="grid grid-cols-2 gap-3">
      <button
        class="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all text-sm font-medium"
        on:click={handleExportOpml}
      >
        <Download size={16} />
        <span>Export</span>
      </button>

      <label
        class="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all cursor-pointer {importingOpml
          ? 'opacity-50 cursor-not-allowed'
          : ''} text-sm font-medium"
      >
        <Upload size={16} />
        <span>{importingOpml ? "Importing..." : "Import"}</span>
        <input type="file" accept=".opml,.xml" on:change={handleImportOpml} disabled={importingOpml} class="hidden" />
      </label>
    </div>

    <!-- Import Progress -->
    {#if importingOpml && importStatus}
      <div class="mt-4 p-4 rounded-xl bg-surface border border-white/5">
        <div class="flex justify-between text-xs text-white/60 mb-2">
          <span>Importing... {importStatus.current} / {importStatus.total}</span>
          <span>{importStatus.total > 0 ? Math.round((importStatus.current / importStatus.total) * 100) : 0}%</span>
        </div>
        <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            class="h-full bg-accent transition-all duration-300 ease-out"
            style="width: {importStatus.total > 0 ? (importStatus.current / importStatus.total) * 100 : 0}%"
          ></div>
        </div>
        <div class="text-[10px] text-white/30 mt-2 truncate font-mono">
          {importStatus.currentName || "Preparing..."}
        </div>
      </div>
    {/if}

    <!-- Import Results -->
    {#if importResults}
      <div class="p-4 rounded-xl bg-black/20 border border-white/10 text-sm mt-4">
        <div class="flex gap-4 mb-2 flex-wrap">
          <span class="text-emerald-400">✓ Added: {importResults.added}</span>
          <span class="text-yellow-400">⊘ Skipped: {importResults.skipped}</span>
          {#if importResults.failed.length > 0}
            <span class="text-red-400">✗ Failed: {importResults.failed.length}</span>
          {/if}
        </div>
        {#if importResults.failed.length > 0}
          <div class="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {#each importResults.failed as fail}
              <div class="text-xs text-red-400/80 break-all">{fail.url}: {fail.error}</div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Backups Section -->
  <div class="mt-8 pt-8 border-t border-white/5">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h3 class="text-base font-medium text-white">Backups</h3>
        <p class="text-xs text-white/50">Manage your data exports (OPML & Settings)</p>
      </div>
      <button
        class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-colors flex items-center gap-2"
        on:click={handleCreateBackup}
        disabled={backupLoading}
      >
        {#if backupLoading}
          <Loader2 size={12} class="animate-spin" />
        {:else}
          <Database size={12} />
        {/if}
        Create Backup
      </button>
    </div>

    {#if backups.length === 0}
      <div class="text-sm text-white/30 italic">No backups found.</div>
    {:else}
      <div class="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
        {#each backups as backup}
          <div
            class="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                {#if backup.filename.endsWith(".json")}
                  <SettingsIcon size={14} />
                {:else}
                  <List size={14} />
                {/if}
              </div>
              <div class="flex flex-col">
                <span class="text-sm text-white font-medium truncate max-w-[200px]">{backup.filename}</span>
                <span class="text-[10px] text-white/40">
                  {new Date(backup.createdAt).toLocaleDateString()}
                  {new Date(backup.createdAt).toLocaleTimeString()} • {(backup.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>
            <a
              href="/api/backups/{backup.filename}"
              class="p-2 rounded-lg bg-black/20 hover:bg-emerald-500 hover:text-white text-white/50 transition-colors"
              download
              title="Download"
            >
              <Download size={14} />
            </a>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
