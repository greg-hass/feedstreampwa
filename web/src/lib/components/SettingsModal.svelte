<script lang="ts">
  import { X, Settings as SettingsIcon, Save, Loader2 } from "lucide-svelte";
  import { isSettingsModalOpen } from "$lib/stores/ui";
  import { settings } from "$lib/stores/settings";
  import { updateSettings } from "$lib/api/settings";
  import { feeds, loadFeeds } from "$lib/stores/feeds";
  import { loadFolders } from "$lib/stores/folders";
  import { onMount } from "svelte";
  import type { Settings, ImportResult } from "$lib/types";

  // Child Components
  import GeneralSettings from "./settings/GeneralSettings.svelte";
  import FeedManagement from "./settings/FeedManagement.svelte";
  import DataSettings from "./settings/DataSettings.svelte";
  import AutomationSettings from "./settings/AutomationSettings.svelte";

  // Ensure all settings fields have defaults
  const defaultSettings: Settings = { sync_interval: 'off', gemini_api_key: '' };
  let localSettings: Settings = { ...defaultSettings, ...$settings };
  let saving = false;
  let error: string | null = null;
  let successMessage = false;

  // Tabs
  type Tab = "general" | "feeds" | "data" | "automation";
  let activeTab: Tab = "general";

  // Automation logic
  let rules: any[] = [];
  let newRule = { keyword: "", field: "title", action: "mark_read", name: "" };
  let rulesLoading = false;
  let rulesError: string | null = null;

  async function loadRules() {
    rulesLoading = true;
    rulesError = null;
    try {
      const res = await fetch("/api/rules");
      const data = await res.json();
      if (data.ok) rules = data.rules;
    } catch (e) {
      rulesError = "Failed to load rules";
    } finally {
      rulesLoading = false;
    }
  }

  async function handleCreateRule() {
    if (!newRule.keyword) return;
    try {
      await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRule),
      });
      await loadRules();
      newRule = { keyword: "", field: "title", action: "mark_read", name: "" };
    } catch (e) {
      console.error("Failed to create rule:", e);
    }
  }

  async function handleDeleteRule(id: string) {
    try {
      await fetch(`/api/rules/${id}`, { method: "DELETE" });
      await loadRules();
    } catch (e) {
      console.error("Failed to delete rule:", e);
    }
  }

  // Data & OPML logic
  let backups: any[] = [];
  let backupLoading = false;
  let importingOpml = false;
  let importStatus: any = null;
  let importResults: ImportResult | null = null;
  let importJobId: string | null = null;

  async function loadBackups() {
    try {
      const res = await fetch(`/api/backups`);
      const data = await res.json();
      if (data.ok) backups = data.backups;
    } catch (e) {
      console.error(e);
    }
  }

  async function handleCreateBackup() {
    backupLoading = true;
    try {
      const res = await fetch(`/api/backups`, { method: "POST" });
      const data = await res.json();
      if (data.ok) await loadBackups();
    } catch (e) {
      error = "Backup failed";
    } finally {
      backupLoading = false;
    }
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

  async function handleImportOpml(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    importingOpml = true;
    error = null;
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
          if (data.status.status === "completed" || data.status.status === "failed") {
            clearInterval(timer);
            importingOpml = false;
            if (data.status.status === "completed") {
              importResults = data.status.result;
              loadFeeds();
              loadFolders();
            } else {
              error = "Import failed: " + (data.status.errors[0] || "Unknown error");
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

  // Lifecycle - only reset when modal opens, not on every $settings change
  let wasOpen = false;
  $: {
    if ($isSettingsModalOpen && !wasOpen) {
      // Modal just opened - reset to current settings
      localSettings = { ...defaultSettings, ...$settings };
      activeTab = "general";
    }
    wasOpen = $isSettingsModalOpen;
  }

  $: if (activeTab === "data") {
    loadBackups();
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
      setTimeout(() => (successMessage = false), 2000);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to save settings";
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    closeModal();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") handleCancel();
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.currentTarget !== event.target) return;
    handleCancel();
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCancel();
    }
  }

  function setTab(tab: string) {
    activeTab = tab as Tab;
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $isSettingsModalOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    on:click|self={handleCancel}
  >
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="bg-zinc-900 rounded-2xl border border-zinc-700 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      on:click|stopPropagation={() => {}}
      role="dialog"
      aria-modal="true"
    >
      <!-- Header -->
      <div class="bg-zinc-900 border-b border-zinc-800 px-6 pt-6 pb-0 flex-shrink-0">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center">
              <SettingsIcon size={20} class="text-blue-400" />
            </div>
            <div>
              <h2 class="text-xl font-semibold text-white">Settings</h2>
              <p class="text-sm text-zinc-400">Preferences & Management</p>
            </div>
          </div>
          <button class="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white" on:click={handleCancel}>
            <X size={20} />
          </button>
        </div>

        <div class="flex gap-6">
          {#each ["general", "feeds", "data", "automation"] as tab}
            <button
              class="pb-3 text-sm font-medium border-b-2 transition-colors {activeTab === tab ? 'text-accent border-accent' : 'text-zinc-400 border-transparent hover:text-white'}"
              on:click={() => setTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {#if tab === "feeds"}({$feeds.length}){/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Body -->
      <div class="p-6 overflow-y-auto flex-1">
        {#if activeTab === "general"}
          <GeneralSettings bind:localSettings />
        {:else if activeTab === "feeds"}
          <FeedManagement />
        {:else if activeTab === "data"}
          <DataSettings 
            bind:importingOpml 
            bind:importStatus 
            bind:importResults 
            {backups} 
            {backupLoading} 
            {handleCreateBackup} 
            {handleExportOpml} 
            {handleImportOpml} 
          />
        {:else if activeTab === "automation"}
          <AutomationSettings 
            {rules} 
            {rulesLoading} 
            {rulesError} 
            {loadRules} 
            {handleCreateRule} 
            {handleDeleteRule} 
            bind:newRule 
          />
        {/if}

        {#if error}
          <div class="p-4 mt-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        {/if}

        {#if successMessage}
          <div class="p-4 mt-6 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
            <Save size={16} />
            Settings saved!
          </div>
        {/if}
      </div>

      <!-- Footer -->
      {#if activeTab === "general"}
        <div class="sticky bottom-0 bg-zinc-900 border-t border-zinc-800 px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
          <button class="px-4 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium" on:click={handleCancel}>
            Cancel
          </button>
          <button class="px-6 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50 text-sm font-bold" on:click={handleSave} disabled={saving}>
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
