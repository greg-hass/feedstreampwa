<script lang="ts">
  import { Settings } from "lucide-svelte";
  import { setViewSettings, viewMode } from "$lib/stores/ui";
</script>

<div class="flex-shrink-0 p-4 border-t border-white/5 bg-[#121212] space-y-2">
  <!-- Settings -->
  <button
    class="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-colors text-white/60 hover:text-white
      {$viewMode === 'settings' ? 'bg-white/10 text-white' : ''}"
    on:click={() => setViewSettings()}
  >
    <Settings size={24} />
    <span class="text-sm font-medium">Settings</span>
  </button>
</div>
