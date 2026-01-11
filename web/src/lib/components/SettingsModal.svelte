<script lang="ts">
  import {
    X,
    Save,
    Settings as SettingsIcon,
    Download,
    Upload,
    Loader2,
    List,
    Database,
    Trash2,
    Edit2,
    Folder as FolderIcon,
    Rss,
  } from "lucide-svelte";
  import { isSettingsModalOpen, renameModal, feedFolderPopover } from "$lib/stores/ui";
  import { settings, loadSettings } from "$lib/stores/settings";
  import { updateSettings } from "$lib/api/settings";
  import { feeds, removeFeed } from "$lib/stores/feeds";
  import { onMount } from "svelte";
  import type { Settings, ImportResult, Feed } from "$lib/types";

  let localSettings: Settings = { ...$settings };
  let saving = false;
  let error: string | null = null;
  let successMessage = false;
  let importResults: ImportResult | null = null;
  let importingOpml = false;

  // Tabs
  type Tab = "general" | "feeds" | "data";
  let activeTab: Tab = "general";

  // Sync local settings when store updates
  $: if ($isSettingsModalOpen) {
    localSettings = { ...$settings };
    activeTab = "general"; // Reset tab
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
      // Only save on enter if not in feeds tab (to avoid accidental saves while managing)
      if (activeTab !== "feeds") handleSave();
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
      input.value = "";
    }
  }

  function handleRenameFeed(feed: Feed) {
    renameModal.set({
      isOpen: true,
      type: "feed",
      targetId: feed.url,
      currentName: feed.title || "",
    });
  }

  function handleMoveFeed(feed: Feed, event: MouseEvent) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    feedFolderPopover.set({
      isOpen: true,
      feed: feed,
      position: { x: rect.left, y: rect.bottom + 5 },
    });
  }

  function handleDeleteFeed(feed: Feed) {
    removeFeed(feed.url);
  }

  function handleImageError(event: Event) {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.style.display = "none";
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
    { value: "light", label: "Light", description: "Light theme" },
    { value: "dark", label: "Dark", description: "Dark theme" },
    { value: "system", label: "System", description: "System preference" },
  ] as const;

  // Sync interval options
  const syncIntervalOptions = [
    { value: "off", label: "Off" },
    { value: "15m", label: "15m" },
    { value: "1h", label: "1h" },
    { value: "4h", label: "4h" },
  ];
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $isSettingsModalOpen}
  <!-- Modal Backdrop -->
  <div
    class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
    on:click={handleCancel}
    on:keydown={handleBackdropKeydown}
    role="button"
    tabindex="-1"
  >
    <!-- Modal Content -->
    <div
      class="bg-surface rounded-2xl border border-white/5 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header with Tabs -->
      <div class="bg-surface border-b border-white/5 px-6 pt-6 pb-0 flex-shrink-0">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div
              class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center"
            >
              <SettingsIcon size={20} class="text-blue-400" />
            </div>
            <div>
              <h2 class="text-xl font-semibold text-white">Settings</h2>
              <p class="text-sm text-white/60">Preferences & Management</p>
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

        <!-- Navigation Tabs -->
        <div class="flex gap-6">
          <button
            class="pb-3 text-sm font-medium border-b-2 transition-colors {activeTab ===
            'general'
              ? 'text-accent border-accent'
              : 'text-white/60 border-transparent hover:text-white'}"
            on:click={() => (activeTab = "general")}
          >
            General
          </button>
          <button
            class="pb-3 text-sm font-medium border-b-2 transition-colors {activeTab ===
            'feeds'
              ? 'text-accent border-accent'
              : 'text-white/60 border-transparent hover:text-white'}"
            on:click={() => (activeTab = "feeds")}
          >
            Feeds ({$feeds.length})
          </button>
          <button
            class="pb-3 text-sm font-medium border-b-2 transition-colors {activeTab ===
            'data'
              ? 'text-accent border-accent'
              : 'text-white/60 border-transparent hover:text-white'}"
            on:click={() => (activeTab = "data")}
          >
            Data & OPML
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="p-6 overflow-y-auto flex-1">
        {#if activeTab === "general"}
          <!-- General Settings -->
          <div class="space-y-8">
            <div class="space-y-3">
              <label class="block">
                <span class="text-sm font-semibold text-white mb-3 block"
                  >Theme</span
                >
                <div class="grid grid-cols-3 gap-3">
                  {#each themeOptions as option}
                    <button
                      type="button"
                      class="p-3 rounded-xl border transition-all text-left {localSettings.theme ===
                      option.value
                        ? 'bg-accent/10 border-accent text-white'
                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'}"
                      on:click={() => handleThemeChange(option.value)}
                    >
                      <div class="font-medium text-sm">{option.label}</div>
                      <div class="text-[11px] opacity-60">
                        {option.description}
                      </div>
                    </button>
                  {/each}
                </div>
              </label>
            </div>

            <div class="space-y-3">
              <label class="block">
                <span class="text-sm font-semibold text-white mb-3 block"
                  >Auto-sync Interval</span
                >
                <select
                  bind:value={localSettings.sync_interval}
                  class="w-full bg-white/5 px-4 py-3 rounded-xl text-white border border-white/10 hover:bg-white/10 focus:border-accent/50 transition-colors outline-none text-sm"
                >
                  {#each syncIntervalOptions as option}
                    <option value={option.value}>{option.label}</option>
                  {/each}
                </select>
              </label>
            </div>
          </div>
        {:else if activeTab === "feeds"}
          <!-- Feed Management -->
          <div class="space-y-4">
            {#if $feeds.length === 0}
              <div class="text-center py-12 text-white/40">
                <Rss size={32} class="mx-auto mb-3 opacity-50" />
                <p>No feeds found.</p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each $feeds as feed}
                  <div
                    class="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors group"
                  >
                    <!-- Icon -->
                    <div
                      class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0"
                    >
                      {#if feed.icon_url}
                        <img
                          src={feed.icon_url}
                          alt=""
                          class="w-full h-full object-cover rounded-lg"
                          on:error={handleImageError}
                        />
                      {:else}
                        <Rss size={14} class="text-white/40" />
                      {/if}
                    </div>

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-medium text-white truncate">
                        {feed.title || feed.url}
                      </div>
                      <div class="text-xs text-white/40 truncate">
                        {feed.url}
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-1">
                      <button
                        class="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Move to folder"
                        on:click={(e) => handleMoveFeed(feed, e)}
                      >
                        <FolderIcon size={16} />
                      </button>
                      <button
                        class="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Rename"
                        on:click={() => handleRenameFeed(feed)}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        class="p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                        on:click={() => handleDeleteFeed(feed)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {:else if activeTab === "data"}
          <!-- Data & OPML -->
          <div class="space-y-6">
            <div class="space-y-3">
              <h3
                class="text-sm font-semibold text-white uppercase tracking-wider"
              >
                OPML Import / Export
              </h3>
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
                  class="p-4 rounded-xl bg-black/20 border border-white/10 text-sm mt-4"
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
          </div>
        {/if}

        <!-- Messages -->
        {#if error}
          <div
            class="p-4 mt-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            {error}
          </div>
        {/if}

        {#if successMessage}
          <div
            class="p-4 mt-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2"
          >
            <Save size={16} />
            Settings saved!
          </div>
        {/if}
      </div>

      <!-- Footer (Only for General Tab) -->
      {#if activeTab === "general"}
        <div
          class="sticky bottom-0 bg-surface border-t border-white/5 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl"
        >
          <button
            class="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
            on:click={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            class="px-6 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
            on:click={handleSave}
            disabled={saving}
          >
            {#if saving}
              <Loader2 size={16} class="animate-spin" />
              Saving...
            {:else}
              Save Changes
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
