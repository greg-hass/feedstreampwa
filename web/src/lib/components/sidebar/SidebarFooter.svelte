<script lang="ts">
  import {
    Settings,
    Sparkles,
    Activity,
    Copy,
  } from "lucide-svelte";
  import { isSettingsModalOpen } from "$lib/stores/ui";
  import AIRecommendationsModal from "$lib/components/modals/AIRecommendationsModal.svelte";
  import FeedHealthModal from "$lib/components/modals/FeedHealthModal.svelte";
  import DuplicatesModal from "$lib/components/modals/DuplicatesModal.svelte";
  
  let isAIRecommendationsOpen = false;
  let isFeedHealthOpen = false;
  let isDuplicatesOpen = false;
</script>

<div class="flex-shrink-0 p-4 border-t border-white/5 bg-[#121212] space-y-2">
  <!-- AI Recommendations -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 hover:from-purple-500/20 hover:to-pink-500/20 transition-all text-white group"
    on:click={() => (isAIRecommendationsOpen = true)}
  >
    <Sparkles size={24} class="text-purple-400 group-hover:text-purple-300" />
    <span class="text-sm font-semibold">AI Recommendations</span>
  </button>

  <!-- Feed Health -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white"
    on:click={() => (isFeedHealthOpen = true)}
  >
    <Activity size={24} />
    <span class="text-sm font-medium">Feed Health</span>
  </button>

  <!-- Duplicates -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white"
    on:click={() => (isDuplicatesOpen = true)}
  >
    <Copy size={24} class="text-orange-400 group-hover:text-orange-300" />
    <span class="text-sm font-medium">Duplicates</span>
  </button>

  <!-- Settings -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white"
    on:click={() => isSettingsModalOpen.set(true)}
  >
    <Settings size={24} />
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
