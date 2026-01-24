<script lang="ts">
  import { Settings, Plus, Sparkles, Activity, Copy } from "lucide-svelte";
  import { setViewSettings, setViewAddFeed, viewMode } from "$lib/stores/ui";
  import AIRecommendationsModal from "$lib/components/modals/AIRecommendationsModal.svelte";
  import FeedHealthModal from "$lib/components/modals/FeedHealthModal.svelte";
  import DuplicatesModal from "$lib/components/modals/DuplicatesModal.svelte";

  let isAIRecommendationsOpen = false;
  let isFeedHealthOpen = false;
  let isDuplicatesOpen = false;
</script>

<div class="flex-shrink-0 p-4 border-t border-zinc-800 bg-zinc-950 space-y-2">
  <!-- Add Feed -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
      {$viewMode === 'add-feed'
        ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'}"
    on:click={() => setViewAddFeed()}
  >
    <Plus size={20} strokeWidth={2.5} />
    <span class="text-sm font-semibold">Add Feed</span>
  </button>

  <!-- AI Recommendations -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 hover:from-emerald-500/20 hover:to-teal-500/20 transition-all text-white group"
    on:click={() => (isAIRecommendationsOpen = true)}
  >
    <Sparkles size={20} class="text-emerald-400 group-hover:text-emerald-300" />
    <span class="text-sm font-semibold">AI Recommendations</span>
  </button>

  <!-- Feed Health -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white"
    on:click={() => (isFeedHealthOpen = true)}
  >
    <Activity size={20} />
    <span class="text-sm font-medium">Feed Health</span>
  </button>

  <!-- Duplicates -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white"
    on:click={() => (isDuplicatesOpen = true)}
  >
    <Copy size={20} class="text-orange-400" />
    <span class="text-sm font-medium">Duplicates</span>
  </button>

  <!-- Settings -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white
      {$viewMode === 'settings' ? 'bg-white/10 text-white' : ''}"
    on:click={() => setViewSettings()}
  >
    <Settings size={20} />
    <span class="text-sm font-medium">Settings</span>
  </button>
</div>

<!-- Modals -->
<AIRecommendationsModal
  bind:isOpen={isAIRecommendationsOpen}
  on:close={() => (isAIRecommendationsOpen = false)}
/>

<FeedHealthModal bind:isOpen={isFeedHealthOpen} />

<DuplicatesModal bind:isOpen={isDuplicatesOpen} />
