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
    ChevronRight,
    ChevronDown,
    FolderOpen,
    Palette,
    Sun,
    Moon,
    Monitor,
  } from "lucide-svelte";
  import {
    isSettingsModalOpen,
    renameModal,
    feedFolderPopover,
  } from "$lib/stores/ui";
  import { settings, loadSettings } from "$lib/stores/settings";
  import { updateSettings } from "$lib/api/settings";
  import { feeds, removeFeed, loadFeeds } from "$lib/stores/feeds";
  import { feedsTree } from "$lib/stores/counts";
  import { loadFolders, folders } from "$lib/stores/folders";
  import { theme, colorSchemes, type ColorScheme, type ThemeMode } from "$lib/stores/theme";
  import { onMount } from "svelte";
  import type { Settings, ImportResult, Feed } from "$lib/types";

  let localSettings: Settings = { ...$settings };
  let saving = false;
  let error: string | null = null;
  let successMessage = false;
  let importResults: ImportResult | null = null;
  let importingOpml = false;

  let openFolders: Record<string, boolean> = {};

  function toggleFolder(id: string) {
    if (openFolders[id]) {
      const newFolders = { ...openFolders };
      delete newFolders[id];
      openFolders = newFolders;
    } else {
      openFolders = { ...openFolders, [id]: true };
    }
  }

  // Tabs
  type Tab = "general" | "feeds" | "data" | "automation";
  let activeTab: Tab = "general";

  // Rules
  interface Rule {
    id: string;
    name?: string;
    keyword: string;
    field: string;
    action: string;
    feed_url?: string;
  }
  let rules: Rule[] = [];
  let newRule = { keyword: "", field: "title", action: "mark_read", name: "" };

  async function loadRules() {
    const res = await fetch("http://localhost:3000/rules");
    const data = await res.json();
    if (data.ok) rules = data.rules;
  }

  async function handleCreateRule() {
    if (!newRule.keyword) return;
    await fetch("http://localhost:3000/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRule),
    });
    await loadRules();
    newRule = { keyword: "", field: "title", action: "mark_read", name: "" };
  }

  async function handleDeleteRule(id: string) {
    await fetch(`http://localhost:3000/rules/${id}`, { method: "DELETE" });
    await loadRules();
  }

  $: if (activeTab === "automation") loadRules();

  // Backups
  let backups: any[] = [];
  let backupLoading = false;

  async function loadBackups() {
    try {
      const res = await fetch(`http://localhost:3000/backups`);
      const data = await res.json();
      if (data.ok) {
        backups = data.backups;
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateBackup() {
    backupLoading = true;
    try {
      const res = await fetch(`http://localhost:3000/backups`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.ok) {
        await loadBackups();
      }
    } catch (e) {
      error = "Backup failed";
    } finally {
      backupLoading = false;
    }
  }

  $: if (activeTab === "data") {
    loadBackups();
  }

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

  function handleThemeChange(mode: ThemeMode) {
    theme.setMode(mode);
  }

  function handleColorSchemeChange(scheme: ColorScheme) {
    theme.setColorScheme(scheme);
  }

  // Custom color inputs
  let showCustomColors = false;
  let customColors = {
    primary: '#10B981',
    background: '#050507',
    surface: '#0e0e11',
    raised: '#16161a',
  };

  function applyCustomColors() {
    theme.setCustomColors(customColors);
  }

  async function handleExportOpml() {
    try {
      const response = await fetch("/api/opml/export");
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

  let importJobId: string | null = null;
  let importStatus: {
    status: string;
    current: number;
    total: number;
    currentName?: string;
    result?: ImportResult;
  } | null = null;

  async function handleImportOpml(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    importingOpml = true;
    error = null;
    importStatus = null;
    importResults = null;

    try {
      const text = await input.files[0].text();

      const response = await fetch("/api/opml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opml: text }),
      });

      if (!response.ok) throw new Error("Import failed to start");

      const data = await response.json();
      importJobId = data.jobId;

      pollImportStatus();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to import OPML";
      importingOpml = false;
    } finally {
      // Reset file input
      input.value = "";
    }
  }

  async function pollImportStatus() {
    if (!importJobId) return;

    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/opml/status/${importJobId}`);
        const data = await res.json();

        if (data.ok) {
          importStatus = data.status;

          if (
            data.status.status === "completed" ||
            data.status.status === "failed"
          ) {
            clearInterval(timer);
            importingOpml = false;

            if (data.status.status === "completed") {
              importResults = data.status.result;
              loadFeeds();
              loadFolders();
            } else {
              error =
                "Import failed: " + (data.status.errors[0] || "Unknown error");
            }
          }
        }
      } catch (e) {
        clearInterval(timer);
        importingOpml = false;
        error = "Failed to track import status";
      }
    }, 500);
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
      class="bg-[#18181b] rounded-2xl border border-white/10 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header with Tabs -->
      <div
        class="bg-[#18181b] rounded-t-2xl border-b border-white/10 px-6 pt-6 pb-0 flex-shrink-0"
      >
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
          <button
            class="pb-3 text-sm font-medium border-b-2 transition-colors {activeTab ===
            'automation'
              ? 'text-accent border-accent'
              : 'text-white/60 border-transparent hover:text-white'}"
            on:click={() => (activeTab = "automation")}
          >
            Automation
          </button>
        </div>
      </div>

      <!-- Body -->
      <div class="p-6 overflow-y-auto flex-1">
        {#if activeTab === "general"}
          <!-- General Settings -->
          <div class="space-y-8">
            <!-- Theme Mode -->
            <div class="space-y-3">
              <span class="text-sm font-semibold text-white flex items-center gap-2">
                <Palette size={16} />
                Appearance
              </span>

              <!-- Light/Dark/System -->
              <div class="grid grid-cols-3 gap-3">
                {#each ['light', 'dark', 'system'] as mode}
                  {@const isActive = $theme.mode === mode}
                  {@const icon = mode === 'light' ? Sun : mode === 'dark' ? Moon : Monitor}
                  <button
                    type="button"
                    class="p-3 rounded-xl border transition-all text-left flex items-center gap-2 {isActive
                      ? 'bg-accent/10 border-accent text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'}"
                    on:click={() => handleThemeChange(mode)}
                  >
                    <svelte:component this={icon} size={18} />
                    <div>
                      <div class="font-medium text-sm capitalize">{mode}</div>
                      <div class="text-[11px] opacity-60">
                        {mode === 'system' ? 'Follow system' : `${mode} mode`}
                      </div>
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Color Schemes -->
            <div class="space-y-3">
              <span class="text-sm font-semibold text-white">Color Scheme</span>
              <div class="grid grid-cols-3 gap-3">
                {#each Object.entries(colorSchemes) as [key, scheme]}
                  {@const isActive = $theme.colorScheme === key}
                  <button
                    type="button"
                    class="p-3 rounded-xl border transition-all text-left {isActive
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'}"
                    on:click={() => handleColorSchemeChange(key)}
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <div
                        class="w-4 h-4 rounded-full shadow-lg"
                        style="background-color: {scheme.accent}"
                      ></div>
                      <div class="font-medium text-sm">{scheme.name}</div>
                    </div>
                    <div class="text-[11px] opacity-60">{scheme.description}</div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Custom Colors (Advanced) -->
            <div class="space-y-3">
              {#if $theme.colorScheme === 'custom' || showCustomColors}
                <div class="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-semibold text-white">Custom Colors</span>
                    <button
                      type="button"
                      class="text-xs px-3 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                      on:click={applyCustomColors}
                    >
                      Apply Colors
                    </button>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1">
                      <label class="text-xs text-white/60">Primary Accent</label>
                      <div class="flex items-center gap-2">
                        <input
                          type="color"
                          bind:value={customColors.primary}
                          class="w-8 h-8 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          bind:value={customColors.primary}
                          class="flex-1 bg-white/5 px-2 py-1 rounded text-sm text-white border border-white/10"
                        />
                      </div>
                    </div>
                    <div class="space-y-1">
                      <label class="text-xs text-white/60">Background</label>
                      <div class="flex items-center gap-2">
                        <input
                          type="color"
                          bind:value={customColors.background}
                          class="w-8 h-8 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          bind:value={customColors.background}
                          class="flex-1 bg-white/5 px-2 py-1 rounded text-sm text-white border border-white/10"
                        />
                      </div>
                    </div>
                    <div class="space-y-1">
                      <label class="text-xs text-white/60">Surface</label>
                      <div class="flex items-center gap-2">
                        <input
                          type="color"
                          bind:value={customColors.surface}
                          class="w-8 h-8 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          bind:value={customColors.surface}
                          class="flex-1 bg-white/5 px-2 py-1 rounded text-sm text-white border border-white/10"
                        />
                      </div>
                    </div>
                    <div class="space-y-1">
                      <label class="text-xs text-white/60">Raised</label>
                      <div class="flex items-center gap-2">
                        <input
                          type="color"
                          bind:value={customColors.raised}
                          class="w-8 h-8 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          bind:value={customColors.raised}
                          class="flex-1 bg-white/5 px-2 py-1 rounded text-sm text-white border border-white/10"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              {:else}
                <button
                  type="button"
                  class="text-xs px-3 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  on:click={() => (showCustomColors = true)}
                >
                  + Custom Colors
                </button>
              {/if}
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

            <div class="space-y-3">
              <label class="block">
                <div class="flex items-center justify-between mb-3">
                  <span
                    class="text-sm font-semibold text-white flex items-center gap-2"
                  >
                    <svg
                      class="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        d="M12 2L2 7l10 5 10-5-10-5z"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M2 17l10 5 10-5"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                      <path
                        d="M2 12l10 5 10-5"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    Gemini API Key
                  </span>
                  <span class="text-xs text-white/40">Optional</span>
                </div>
                <input
                  type="password"
                  bind:value={localSettings.gemini_api_key}
                  placeholder="Enter your Gemini API key..."
                  class="w-full bg-white/5 px-4 py-3 rounded-xl text-white border border-white/10 hover:bg-white/10 focus:border-purple-500/50 transition-colors outline-none text-sm font-mono"
                />
                <p class="text-xs text-white/40 mt-2">
                  Enable AI-powered feed recommendations. Get your API key from
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-purple-400 hover:text-purple-300 underline"
                  >
                    Google AI Studio
                  </a>
                  . Your key is stored securely on the server and never exposed to
                  the browser.
                </p>
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
              <div class="space-y-4">
                <!-- Folders -->
                {#each $folders as folder}
                  <div class="space-y-1">
                    <button
                      class="flex items-center gap-2 w-full p-2 hover:bg-white/5 rounded-lg text-left transition-colors"
                      on:click={() => toggleFolder(folder.id)}
                    >
                      {#if openFolders[folder.id]}
                        <ChevronDown size={16} class="text-white/40" />
                      {:else}
                        <ChevronRight size={16} class="text-white/40" />
                      {/if}
                      <FolderOpen size={18} class="text-accent" />
                      <span class="text-sm font-medium text-white"
                        >{folder.name}</span
                      >
                      <span class="text-xs text-white/40 ml-auto">
                        {($feedsTree.byFolder[folder.id] || []).length} feeds
                      </span>
                    </button>

                    {#if openFolders[folder.id]}
                      <div class="ml-6 pl-2 border-l border-white/5 space-y-2">
                        {#each $feedsTree.byFolder[folder.id] || [] as feed}
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
                              <div
                                class="text-sm font-medium text-white truncate"
                              >
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
                        {#if ($feedsTree.byFolder[folder.id] || []).length === 0}
                          <div class="text-xs text-white/20 italic px-3 py-2">
                            Empty folder
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/each}

                <!-- Uncategorized -->
                {#if $feedsTree.uncategorized.length > 0}
                  <div class="space-y-2">
                    {#if $folders.length > 0}
                      <div
                        class="text-xs font-semibold text-white/30 uppercase tracking-wider px-2 pt-2"
                      >
                        Uncategorized
                      </div>
                    {/if}
                    {#each $feedsTree.uncategorized as feed}
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

              <!-- Import Progress -->
              {#if importingOpml && importStatus}
                <div
                  class="mt-4 p-4 rounded-xl bg-surface border border-white/5"
                >
                  <div class="flex justify-between text-xs text-white/60 mb-2">
                    <span
                      >Importing... {importStatus.current} / {importStatus.total}</span
                    >
                    <span
                      >{importStatus.total > 0
                        ? Math.round(
                            (importStatus.current / importStatus.total) * 100
                          )
                        : 0}%</span
                    >
                  </div>
                  <div class="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-accent transition-all duration-300 ease-out"
                      style="width: {importStatus.total > 0
                        ? (importStatus.current / importStatus.total) * 100
                        : 0}%"
                    ></div>
                  </div>
                  <div
                    class="text-[10px] text-white/30 mt-2 truncate font-mono"
                  >
                    {importStatus.currentName || "Preparing..."}
                  </div>
                </div>
              {/if}

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
            <!-- Backups Section -->
            <div class="mt-8 pt-8 border-t border-white/5">
              <div class="flex items-center justify-between mb-4">
                <div>
                  <h3 class="text-base font-medium text-white">Backups</h3>
                  <p class="text-xs text-white/50">
                    Manage your data exports (OPML & Settings)
                  </p>
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
                <div class="text-sm text-white/30 italic">
                  No backups found.
                </div>
              {:else}
                <div
                  class="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2"
                >
                  {#each backups as backup}
                    <div
                      class="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                    >
                      <div class="flex items-center gap-3">
                        <div
                          class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40"
                        >
                          {#if backup.filename.endsWith(".json")}
                            <SettingsIcon size={14} />
                          {:else}
                            <List size={14} />
                          {/if}
                        </div>
                        <div class="flex flex-col">
                          <span
                            class="text-sm text-white font-medium truncate max-w-[200px]"
                            >{backup.filename}</span
                          >
                          <span class="text-[10px] text-white/40">
                            {new Date(backup.createdAt).toLocaleDateString()}
                            {new Date(backup.createdAt).toLocaleTimeString()} • {(
                              backup.size / 1024
                            ).toFixed(1)} KB
                          </span>
                        </div>
                      </div>
                      <a
                        href="http://localhost:3000/backups/{backup.filename}"
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
        {:else if activeTab === "automation"}
          <div class="p-6 space-y-6">
            <!-- Create Rule Form -->
            <div
              class="bg-white/5 p-4 rounded-xl space-y-4 border border-white/5"
            >
              <h3
                class="text-sm font-medium text-white flex items-center gap-2"
              >
                <Sparkles size={14} /> Create New Rule
              </h3>
              <div class="grid grid-cols-2 gap-4">
                <input
                  bind:value={newRule.keyword}
                  placeholder="Keyword (e.g. 'Sponsor')"
                  class="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-accent outline-none"
                />
                <input
                  bind:value={newRule.name}
                  placeholder="Rule Name (Optional)"
                  class="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-accent outline-none"
                />
              </div>
              <div class="grid grid-cols-3 gap-4">
                <select
                  bind:value={newRule.field}
                  class="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-accent outline-none"
                >
                  <option value="title">Title</option>
                  <option value="content">Content</option>
                  <option value="author">Author</option>
                  <option value="any">Anywhere</option>
                </select>
                <select
                  bind:value={newRule.action}
                  class="bg-black/20 border border-white/10 rounded-lg p-2 text-white text-sm focus:border-accent outline-none"
                >
                  <option value="mark_read">Mark Read</option>
                  <option value="star">Star</option>
                  <option value="delete">Skip/Delete</option>
                </select>
                <button
                  on:click={handleCreateRule}
                  class="bg-accent text-white rounded-lg p-2 text-sm font-medium hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20"
                  >Add Rule</button
                >
              </div>
            </div>

            <!-- Rules List -->
            <div class="space-y-3">
              <h3
                class="text-xs font-medium text-white/40 uppercase tracking-wider"
              >
                Active Rules
              </h3>
              {#if rules.length === 0}
                <div
                  class="text-white/30 text-center py-8 text-sm italic border border-white/5 rounded-xl border-dashed"
                >
                  No rules defined. Add one above!
                </div>
              {:else}
                {#each rules as rule}
                  <div
                    class="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group hover:border-white/10 transition-colors"
                  >
                    <div class="flex flex-col">
                      <span class="text-white text-sm font-medium"
                        >{rule.name || rule.keyword}</span
                      >
                      <span class="text-white/40 text-xs mt-0.5">
                        If <span class="text-white/60">{rule.field}</span>
                        contains "<span class="text-white/60"
                          >{rule.keyword}</span
                        >" →
                        <span
                          class="text-accent/80 font-medium uppercase text-[10px]"
                          >{rule.action.replace("_", " ")}</span
                        >
                      </span>
                    </div>
                    <button
                      on:click={() => handleDeleteRule(rule.id)}
                      class="text-white/20 hover:text-red-400 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                      ><Trash2 size={16} /></button
                    >
                  </div>
                {/each}
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
          class="sticky bottom-0 bg-[#18181b] border-t border-white/10 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl"
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
