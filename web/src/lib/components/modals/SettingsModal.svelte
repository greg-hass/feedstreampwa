<script lang="ts">
  import {
    X,
    Settings,
    Activity,
    Copy,
    Bell,
    Palette,
    Globe,
    Database,
    Clock,
    RefreshCw,
    Shield,
    Info,
    ChevronRight,
    Moon,
    Sun,
    Trash2,
    CheckCircle2
  } from "lucide-svelte";
  import { isSettingsModalOpen } from "$lib/stores/ui";
  import { settings, updateSyncInterval } from "$lib/stores/settings";
  import { fade, slide } from "svelte/transition";
  import DuplicatesModal from "$lib/components/modals/DuplicatesModal.svelte";
  import FeedHealthModal from "$lib/components/modals/FeedHealthModal.svelte";

  let activeTab = "general";
  let isDuplicatesOpen = false;
  let isFeedHealthOpen = false;

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "feeds", label: "Feeds & Content", icon: RssIcon },
    { id: "maintenance", label: "Maintenance", icon: Database },
    { id: "about", label: "About", icon: Info },
  ];

  // Placeholder icon component since Rss is used elsewhere
  function RssIcon(props: any) {
      return null; // Will be replaced by actual icon in loop
  }

  function close() {
    isSettingsModalOpen.set(false);
  }

  function formatInterval(ms: number) {
    if (ms === 0) return "Manual only";
    if (ms < 60000) return `${ms / 1000} seconds`;
    if (ms < 3600000) return `${ms / 60000} minutes`;
    return `${ms / 3600000} hours`;
  }

  const syncOptions = [
    { value: 0, label: "Manual only" },
    { value: 900000, label: "Every 15 minutes" },
    { value: 1800000, label: "Every 30 minutes" },
    { value: 3600000, label: "Every hour" },
    { value: 14400000, label: "Every 4 hours" },
  ];
</script>

{#if $isSettingsModalOpen}
  <div
    class="fixed inset-0 z-50 bg-background md:bg-black/80 md:backdrop-blur-sm flex items-center justify-center"
    transition:fade={{ duration: 200 }}
  >
    <!-- Desktop Modal / Mobile Fullscreen -->
    <div
      class="w-full h-full md:w-[900px] md:h-[650px] bg-background md:bg-[#18181b] md:border md:border-white/10 md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-stroke bg-surface/50 backdrop-blur-md">
        <h2 class="text-xl font-bold text-white flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-surface border border-stroke flex items-center justify-center">
            <Settings size={18} class="text-accent" />
          </div>
          Settings
        </h2>
        <button
          class="p-2 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          on:click={close}
        >
          <X size={24} />
        </button>
      </div>

      <div class="flex flex-1 overflow-hidden">
        <!-- Sidebar -->
        <div class="w-64 bg-surface border-r border-stroke hidden md:block overflow-y-auto">
          <div class="p-4 space-y-1">
            {#each tabs as tab}
              <button
                class="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left
                {activeTab === tab.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'}"
                on:click={() => (activeTab = tab.id)}
              >
                <svelte:component
                  this={tab.id === 'feeds' ? Activity : tab.icon}
                  size={18}
                  class={activeTab === tab.id ? 'text-accent' : 'text-current'}
                />
                {tab.label}
              </button>
            {/each}
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto bg-background p-4 md:p-8">
          <!-- Mobile Tabs -->
          <div class="flex overflow-x-auto gap-2 mb-6 md:hidden pb-2 -mx-4 px-4 scrollbar-hide">
            {#each tabs as tab}
              <button
                class="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-all
                {activeTab === tab.id
                  ? 'bg-accent text-zinc-950 border-accent'
                  : 'bg-surface border-stroke text-zinc-400'}"
                on:click={() => (activeTab = tab.id)}
              >
                {tab.label}
              </button>
            {/each}
          </div>

          {#if activeTab === "general"}
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Clock size={20} class="text-zinc-500" />
                  Sync & Updates
                </h3>
                <div class="bg-surface border border-stroke rounded-xl overflow-hidden">
                  <div class="p-4 border-b border-stroke flex items-center justify-between">
                    <div>
                      <div class="font-medium text-white">Auto-refresh Interval</div>
                      <div class="text-xs text-zinc-500 mt-1">How often to check for new articles</div>
                    </div>
                    <select
                      class="bg-background border border-stroke text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-accent"
                      value={$settings.sync_interval}
                      on:change={(e) => updateSyncInterval(e.currentTarget.value)}
                    >
                      {#each syncOptions as option}
                        <option value={option.value}>{option.label}</option>
                      {/each}
                    </select>
                  </div>
                  <div class="p-4 flex items-center justify-between">
                    <div>
                      <div class="font-medium text-white">Refresh on App Open</div>
                      <div class="text-xs text-zinc-500 mt-1">Check for updates when you open FeedStream</div>
                    </div>
                    <button 
                      class="w-12 h-6 rounded-full bg-zinc-700 relative transition-colors"
                      class:bg-accent={$settings.refreshOnOpen}
                      on:click={() => $settings.refreshOnOpen = !$settings.refreshOnOpen}
                    >
                      <div class="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform"
                        class:translate-x-6={$settings.refreshOnOpen}></div>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          
          {:else if activeTab === "appearance"}
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Palette size={20} class="text-zinc-500" />
                  Theme
                </h3>
                <div class="grid grid-cols-2 gap-4">
                  <button class="bg-surface border-2 border-accent rounded-xl p-4 text-left group">
                    <div class="w-full h-24 bg-[#09090b] rounded-lg mb-3 border border-zinc-800 relative overflow-hidden">
                      <div class="absolute top-0 left-0 w-full h-6 bg-black border-b border-zinc-800"></div>
                      <div class="absolute top-8 left-3 w-16 h-2 bg-zinc-800 rounded"></div>
                      <div class="absolute top-12 left-3 w-24 h-2 bg-zinc-800 rounded"></div>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="font-medium text-white">Dark (OLED)</span>
                      <CheckCircle2 size={16} class="text-accent" />
                    </div>
                  </button>
                  <button class="bg-surface border border-stroke rounded-xl p-4 text-left group opacity-50 cursor-not-allowed">
                    <div class="w-full h-24 bg-white rounded-lg mb-3 border border-zinc-200 relative overflow-hidden">
                      <div class="absolute top-0 left-0 w-full h-6 bg-gray-50 border-b border-zinc-200"></div>
                      <div class="absolute top-8 left-3 w-16 h-2 bg-gray-200 rounded"></div>
                      <div class="absolute top-12 left-3 w-24 h-2 bg-gray-200 rounded"></div>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="font-medium text-white">Light</span>
                      <span class="text-xs text-zinc-500">Coming soon</span>
                    </div>
                  </button>
                </div>
              </section>
            </div>

          {:else if activeTab === "feeds"}
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Activity size={20} class="text-zinc-500" />
                  Feed Health
                </h3>
                <div class="bg-surface border border-stroke rounded-xl p-6">
                  <p class="text-zinc-400 text-sm mb-4">
                    Monitor your feeds for errors, unreachable hosts, or broken parsing. Cleaning up broken feeds improves refresh performance.
                  </p>
                  <button 
                    class="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                    on:click={() => isFeedHealthOpen = true}
                  >
                    <Activity size={18} />
                    Check Feed Health
                  </button>
                </div>
              </section>
            </div>

          {:else if activeTab === "maintenance"}
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section>
                <h3 class="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Database size={20} class="text-zinc-500" />
                  Database
                </h3>
                <div class="bg-surface border border-stroke rounded-xl overflow-hidden divide-y divide-stroke">
                  <div class="p-4 flex items-center justify-between">
                    <div>
                      <div class="font-medium text-white">Manage Duplicates</div>
                      <div class="text-xs text-zinc-500 mt-1">Find and merge duplicate feed entries</div>
                    </div>
                    <button 
                      class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                      on:click={() => isDuplicatesOpen = true}
                    >
                      Scan
                    </button>
                  </div>
                  <div class="p-4 flex items-center justify-between">
                    <div>
                      <div class="font-medium text-white">Clear Cache</div>
                      <div class="text-xs text-zinc-500 mt-1">Remove cached images and offline content</div>
                    </div>
                    <button class="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors">
                      Clear
                    </button>
                  </div>
                </div>
              </section>
            </div>

          {:else if activeTab === "about"}
            <div class="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 text-center py-8">
              <div class="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Globe size={40} class="text-accent" />
              </div>
              <h3 class="text-2xl font-bold text-white mb-2">FeedStream</h3>
              <p class="text-zinc-400">Version 1.0.0 (OLED Edition)</p>
              
              <div class="max-w-md mx-auto mt-8 p-6 bg-surface border border-stroke rounded-xl text-left">
                <h4 class="text-sm font-bold text-white mb-4 uppercase tracking-wider">Credits</h4>
                <ul class="space-y-3 text-sm text-zinc-400">
                  <li class="flex justify-between">
                    <span>UI Design</span>
                    <span class="text-white">Dark Swiss</span>
                  </li>
                  <li class="flex justify-between">
                    <span>Icons</span>
                    <span class="text-white">Lucide</span>
                  </li>
                  <li class="flex justify-between">
                    <span>Framework</span>
                    <span class="text-white">SvelteKit + Tailwind</span>
                  </li>
                </ul>
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<DuplicatesModal bind:isOpen={isDuplicatesOpen} />
<FeedHealthModal bind:isOpen={isFeedHealthOpen} />
