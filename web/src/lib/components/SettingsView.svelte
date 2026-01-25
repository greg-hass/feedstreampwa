<script lang="ts">
  import {
    Settings,
    Activity,
    Copy,
    Palette,
    Globe,
    Database,
    Clock,
    CheckCircle2,
    Rss,
    Sparkles,
    Trash2,
    Loader2,
  } from "lucide-svelte";
  import { settings, updateSyncInterval, updatePurgeRetention } from "$lib/stores/settings";
  import { toast } from "$lib/stores/toast";
  import DuplicatesModal from "$lib/components/modals/DuplicatesModal.svelte";
  import AISettings from "$lib/components/settings/AISettings.svelte";
  import FeedHealthView from "$lib/components/FeedHealthView.svelte";

  let activeTab = "general";
  let isDuplicatesOpen = false;
  let isPurging = false;

  const purgeOptions = [
    { value: "never", label: "Never" },
    { value: "7", label: "7 days" },
    { value: "14", label: "14 days" },
    { value: "30", label: "30 days" },
    { value: "60", label: "60 days" },
    { value: "90", label: "90 days" },
  ];

  async function handlePurgeNow() {
    isPurging = true;
    try {
      const response = await fetch("/api/items/purge", { method: "POST" });
      if (!response.ok) {
        throw new Error("Failed to purge items");
      }
      const result = await response.json();
      toast.success(`Purged ${result.deleted} old items`);
    } catch (err) {
      toast.error("Failed to purge items");
      console.error("Purge failed:", err);
    } finally {
      isPurging = false;
    }
  }

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "feeds", label: "Feeds & Content", icon: Rss },
    { id: "maintenance", label: "Maintenance", icon: Database },
    { id: "about", label: "About", icon: Globe },
  ];

  function formatInterval(ms: number) {
    if (ms === 0) return "Manual only";
    if (ms < 60000) return `${ms / 1000} seconds`;
    if (ms < 3600000) return `${ms / 60000} minutes`;
    return `${ms / 3600000} hours`;
  }

  const syncOptions = [
    { value: "0", label: "Manual only" },
    { value: "900000", label: "Every 15 minutes" },
    { value: "1800000", label: "Every 30 minutes" },
    { value: "3600000", label: "Every hour" },
    { value: "14400000", label: "Every 4 hours" },
  ];
</script>

<div class="pb-20">
  <div class="mb-8">
    <div class="flex items-center gap-3 mb-2">
      <div
        class="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-600 flex items-center justify-center shadow-lg shadow-zinc-500/10"
      >
        <Settings size={20} class="text-white" />
      </div>
      <h2 class="text-2xl font-bold text-white">Settings</h2>
    </div>
    <p class="text-zinc-400">
      Manage your feed preferences, appearance, and data.
    </p>
  </div>

  <div class="flex flex-col md:flex-row gap-8">
    <!-- Sidebar -->
    <div class="w-full md:w-56 flex-shrink-0">
      <div class="md:sticky md:top-2">
        {#each tabs as tab}
          <button
            class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
            {activeTab === tab.id
              ? 'bg-zinc-800 text-white border border-zinc-700'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}"
            on:click={() => (activeTab = tab.id)}
          >
            <svelte:component
              this={tab.icon}
              size={18}
              class={activeTab === tab.id ? 'text-emerald-400' : 'text-current'}
            />
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      {#if activeTab === "general"}
        <div class="space-y-6">
          <section class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div class="px-6 py-4 border-b border-zinc-800">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <Clock size={20} class="text-zinc-500" />
                Sync & Updates
              </h3>
            </div>
            <div class="p-6 space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium text-white">Auto-refresh Interval</div>
                  <div class="text-sm text-zinc-500 mt-1">How often to check for new articles</div>
                </div>
                <select
                  class="bg-zinc-950 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={$settings.sync_interval === 'off' ? '0' : $settings.sync_interval}
                  on:change={(e) => updateSyncInterval(e.currentTarget.value === '0' ? 'off' : e.currentTarget.value)}
                >
                  {#each syncOptions as option}
                    <option value={option.value} class="bg-zinc-950 text-white">{option.label}</option>
                  {/each}
                </select>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium text-white">Refresh on App Open</div>
                  <div class="text-sm text-zinc-500 mt-1">Check for updates when you open FeedStream</div>
                </div>
                <button 
                  class="w-12 h-6 rounded-full bg-zinc-700 relative transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
                  class:bg-emerald-500={$settings.refreshOnOpen}
                  on:click={() => $settings.refreshOnOpen = !$settings.refreshOnOpen}
                >
                  <div class="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-200"
                    class:translate-x-6={$settings.refreshOnOpen}></div>
                </button>
              </div>
            </div>
          </section>
        </div>

      {:else if activeTab === "ai"}
        <div class="space-y-6">
          <section class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div class="p-6">
              <AISettings />
            </div>
          </section>
        </div>

      {:else if activeTab === "appearance"}
        <div class="space-y-6">
          <section class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div class="px-6 py-4 border-b border-zinc-800">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <Palette size={20} class="text-zinc-500" />
                Theme
              </h3>
            </div>
            <div class="p-6">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button class="bg-zinc-950 border-2 border-emerald-500 rounded-xl p-4 text-left group relative">
                  <div class="absolute top-4 right-4">
                    <CheckCircle2 size={20} class="text-emerald-500" />
                  </div>
                  <div class="w-full h-24 bg-[#000000] rounded-lg mb-3 border border-zinc-800 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-6 bg-zinc-900 border-b border-zinc-800"></div>
                    <div class="absolute top-8 left-3 w-16 h-2 bg-zinc-800 rounded"></div>
                    <div class="absolute top-12 left-3 w-24 h-2 bg-zinc-800 rounded"></div>
                  </div>
                  <div class="font-medium text-white">Dark (OLED)</div>
                  <div class="text-xs text-zinc-500 mt-1">True black for OLED screens</div>
                </button>
                <button class="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-left group opacity-50 cursor-not-allowed">
                  <div class="w-full h-24 bg-white rounded-lg mb-3 border border-zinc-200 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-full h-6 bg-gray-50 border-b border-zinc-200"></div>
                    <div class="absolute top-8 left-3 w-16 h-2 bg-gray-200 rounded"></div>
                    <div class="absolute top-12 left-3 w-24 h-2 bg-gray-200 rounded"></div>
                  </div>
                  <div class="font-medium text-white">Light</div>
                  <div class="text-xs text-zinc-500 mt-1">Coming soon</div>
                </button>
              </div>
            </div>
          </section>
        </div>

      {:else if activeTab === "feeds"}
        <div class="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <FeedHealthView />
        </div>

      {:else if activeTab === "maintenance"}
        <div class="space-y-6">
          <!-- Purge Old Items Section -->
          <section class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div class="px-6 py-4 border-b border-zinc-800">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <Trash2 size={20} class="text-zinc-500" />
                Purge Old Items
              </h3>
            </div>
            <div class="divide-y divide-zinc-800">
              <div class="p-6 flex items-center justify-between">
                <div>
                  <div class="font-medium text-white">Auto-purge Retention</div>
                  <div class="text-sm text-zinc-500 mt-1">Automatically delete read items older than this</div>
                </div>
                <select
                  class="bg-zinc-950 border border-zinc-700 text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={$settings.purge_retention || 'never'}
                  on:change={(e) => updatePurgeRetention(e.currentTarget.value)}
                >
                  {#each purgeOptions as option}
                    <option value={option.value} class="bg-zinc-950 text-white">{option.label}</option>
                  {/each}
                </select>
              </div>
              <div class="p-6 flex items-center justify-between">
                <div>
                  <div class="font-medium text-white">Purge Now</div>
                  <div class="text-sm text-zinc-500 mt-1">Manually delete old read items based on retention setting</div>
                </div>
                <button
                  class="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  on:click={handlePurgeNow}
                  disabled={isPurging || $settings.purge_retention === 'never'}
                >
                  {#if isPurging}
                    <Loader2 size={16} class="animate-spin" />
                    Purging...
                  {:else}
                    Purge
                  {/if}
                </button>
              </div>
              <div class="px-6 py-4 bg-zinc-950/50">
                <p class="text-xs text-zinc-500 flex items-center gap-2">
                  <span class="text-amber-500">★</span>
                  Bookmarked items are never purged, even if they exceed the retention period.
                </p>
              </div>
            </div>
          </section>

          <!-- Database Maintenance Section -->
          <section class="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div class="px-6 py-4 border-b border-zinc-800">
              <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <Database size={20} class="text-zinc-500" />
                Database Maintenance
              </h3>
            </div>
            <div class="divide-y divide-zinc-800">
              <div class="p-6 flex items-center justify-between">
                <div>
                  <div class="font-medium text-white">Manage Duplicates</div>
                  <div class="text-sm text-zinc-500 mt-1">Find and merge duplicate feed entries</div>
                </div>
                <button
                  class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700 hover:border-zinc-600"
                  on:click={() => isDuplicatesOpen = true}
                >
                  Scan
                </button>
              </div>
              <div class="p-6 flex items-center justify-between">
                <div>
                  <div class="font-medium text-white">Clear Cache</div>
                  <div class="text-sm text-zinc-500 mt-1">Remove cached images and offline content</div>
                </div>
                <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors border border-zinc-700 hover:border-zinc-600">
                  Clear
                </button>
              </div>
            </div>
          </section>
        </div>

      {:else if activeTab === "about"}
        <div class="space-y-6 text-center py-12">
          <div class="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-800 shadow-xl">
            <Globe size={48} class="text-emerald-500" />
          </div>
          <h3 class="text-3xl font-bold text-white mb-2 tracking-tight">FeedStream</h3>
          <p class="text-zinc-500">Version 1.0.0 (OLED Edition)</p>
          
          <div class="max-w-md mx-auto mt-12 text-left space-y-4">
            <div class="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h4 class="text-xs font-bold text-zinc-500 mb-4 uppercase tracking-wider">Credits</h4>
              <ul class="space-y-3 text-sm text-zinc-400">
                <li class="flex justify-between border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                  <span>UI Design</span>
                  <span class="text-white font-medium">Dark Swiss</span>
                </li>
                <li class="flex justify-between border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                  <span>Icons</span>
                  <span class="text-white font-medium">Lucide</span>
                </li>
                <li class="flex justify-between border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                  <span>Framework</span>
                  <span class="text-white font-medium">SvelteKit</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<DuplicatesModal bind:isOpen={isDuplicatesOpen} />
