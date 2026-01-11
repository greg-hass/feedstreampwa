<script lang="ts">
  import { X, Save, Settings as SettingsIcon, Download, Upload, Loader2 } from "lucide-svelte";
  import { isSettingsModalOpen } from "$lib/stores/ui";
  import { settings, loadSettings } from "$lib/stores/settings";
  import { updateSettings } from "$lib/api/settings";
  import { onMount } from "svelte";
  import type { Settings, ImportResult } from "$lib/types";

  let localSettings: Settings = { ...$settings };
  let saving = false;
  let error: string | null = null;
  let successMessage = false;
  let importResults: ImportResult | null = null;
  let importingOpml = false;

  onMount(() => {
    loadSettings();
  });

  // Sync local settings when store updates
  $: if ($isSettingsModalOpen) {
    localSettings = { ...$settings };
  }

  function closeModal() {
    isSettingsModalOpen.set(false);
    error = null;
    successMessage = false;
    importResults = null;
  }

  async function handleSave() {
    saving = true;
    error = null;
    successMessage = false;

    try {
      await updateSettings(localSettings);
      settings.set(localSettings);
      successMessage = true;

      setTimeout(() => {
        successMessage = false;
      }, 2000);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save settings";
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    localSettings = { ...$settings };
    closeModal();
  }

  function handleBackdropKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      handleCancel();
    }
  }

  function handleThemeChange(themeValue: string) {
    localSettings.theme = themeValue as Settings["theme"];
  }

  async function handleExportOpml() {
    try {
      const response = await fetch("/api/feeds/export");
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `feedstream-export-${new Date().toISOString().split("T")[0]}.opml`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to export OPML";
    }
  }

  async function handleImportOpml(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    importingOpml = true;
    error = null;

    try {
      const formData = new FormData();
      formData.append("file", input.files[0]);

      const response = await fetch("/api/feeds/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Import failed");

      importResults = await response.json();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to import OPML";
    } finally {
      importingOpml = false;
      // Reset file input
      input.value = "";
    }
  }

  // Close on escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      handleCancel();
    }
  }

  // Theme options
  const themeOptions = [
    { value: "light", label: "Light", description: "Light theme for daytime use" },
    { value: "dark", label: "Dark", description: "Dark theme for low-light environments" },
    { value: "system", label: "System", description: "Match your system preferences" },
  ] as const;

  // Sync interval options
  const syncIntervalOptions = [
    { value: "off", label: "Off", description: "Disable automatic sync" },
    { value: "5m", label: "5 minutes" },
    { value: "15m", label: "15 minutes" },
    { value: "30m", label: "30 minutes" },
    { value: "1h", label: "1 hour" },
    { value: "4h", label: "4 hours" },
    { value: "12h", label: "12 hours" },
  ];
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $isSettingsModalOpen}
  <!-- Modal Backdrop -->
  <div
    class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click={handleCancel}
    on:keydown={handleBackdropKeydown}
    role="button"
    tabindex="-1"
  >
    <!-- Modal Content -->
    <div
      class="glass rounded-2xl border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between z-10"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center"
          >
            <SettingsIcon size={20} class="text-blue-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white">Settings</h2>
            <p class="text-sm text-white/60">
              Customize your FeedStream experience
            </p>
          </div>
        </div>
        <button
          class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          on:click={handleCancel}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-6">
        <!-- Theme Setting -->
        <div class="space-y-3">
          <label class="block">
            <span class="text-sm font-semibold text-white mb-2 block"
              >Theme</span
            >
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {#each themeOptions as option}
                <button
                  type="button"
                  class="p-4 rounded-xl border transition-all text-left {localSettings.theme ===
                  option.value
                    ? 'bg-accent/10 border-accent text-white'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'}"
                  on:click={() => handleThemeChange(option.value)}
                >
                  <div class="font-medium mb-1">{option.label}</div>
                  <div class="text-xs opacity-60">{option.description}</div>
                </button>
              {/each}
            </div>
          </label>
        </div>

        <!-- Sync Interval Setting -->
        <div class="space-y-3">
          <label class="block">
            <span class="text-sm font-semibold text-white mb-2 block"
              >Auto-sync Interval</span
            >
            <select
              bind:value={localSettings.sync_interval}
              class="w-full bg-white/5 px-4 py-3 rounded-xl text-white border border-white/10 hover:bg-white/10 focus:border-accent/50 transition-colors outline-none"
            >
              {#each syncIntervalOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            <p class="text-xs text-white/40 mt-2">
              {syncIntervalOptions.find((o) => o.value === localSettings.sync_interval)
                ?.description || "Automatically refresh feeds at regular intervals"}
            </p>
          </label>
        </div>

        <!-- OPML Management -->
        <div class="space-y-3">
          <h3
            class="text-sm font-semibold text-white uppercase tracking-wider"
          >
            OPML Management
          </h3>
          <div class="grid grid-cols-2 gap-3">
            <button
              class="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all"
              on:click={handleExportOpml}
            >
              <Download size={18} />
              <span>Export Feeds</span>
            </button>

            <label
              class="flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all cursor-pointer {importingOpml ? 'opacity-50 cursor-not-allowed' : ''}"
            >
              <Upload size={18} />
              <span>{importingOpml ? "Importing..." : "Import Feeds"}</span>
              <input
                type="file"
                accept=".opml,.xml"
                on:change={handleImportOpml}
                disabled={importingOpml}
                class="hidden"
              />
            </label>
          </div>

          <!-- Import Results -->
          {#if importResults}
            <div
              class="p-4 rounded-xl bg-black/20 border border-white/10 text-sm"
            >
              <div class="flex gap-4 mb-2 flex-wrap">
                <span class="text-emerald-400"
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

        <!-- Error Message -->
        {#if error}
          <div
            class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            {error}
          </div>
        {/if}

        <!-- Success Message -->
        {#if successMessage}
          <div
            class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2"
          >
            <Save size={16} />
            Settings saved successfully!
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div
        class="sticky bottom-0 bg-black/90 backdrop-blur-sm border-t border-white/10 px-6 py-4 flex items-center justify-end gap-3"
      >
        <button
          class="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          on:click={handleCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          class="px-6 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={handleSave}
          disabled={saving}
        >
          {#if saving}
            <Loader2 size={16} class="animate-spin" />
            Saving...
          {:else}
            <Save size={16} />
            Save Changes
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Scrollbar styling */
  :global(.overflow-y-auto::-webkit-scrollbar) {
    width: 8px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-track) {
    background: transparent;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  :global(.overflow-y-auto::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
