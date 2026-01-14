<script lang="ts">
  import { refreshState } from "$lib/stores/feeds";
  import { slide } from "svelte/transition";
  import { X, RefreshCw } from "lucide-svelte";

  function close() {
    refreshState.update((s) => ({ ...s, isRefreshing: false }));
  }
</script>

{#if $refreshState.isRefreshing}
  <div
    class="fixed left-1/2 -translate-x-1/2 z-[1500] min-w-[320px] max-w-[400px] bottom-toast"
    transition:slide={{ axis: "y" }}
  >
    <div
      class="bg-[#18181b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
    >
      <!-- Header -->
      <div class="px-5 pt-4 pb-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center"
          >
            <RefreshCw size={16} class="text-purple-400 animate-spin" />
          </div>
          <span class="text-sm font-semibold text-white">Refreshing Feeds</span>
        </div>
        <button
          class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
          on:click={close}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <!-- Progress -->
      <div class="px-5 pb-4 space-y-2">
        <div class="text-xs text-white/40">
          {$refreshState.current} / {$refreshState.total} • {$refreshState.message ||
            "Starting..."}
        </div>
        <div class="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
            style="width: {$refreshState.total > 0
              ? ($refreshState.current / $refreshState.total) * 100
              : 0}%"
          ></div>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .bottom-toast {
    bottom: 24px;
  }

  @media (max-width: 768px) {
    .bottom-toast {
      bottom: calc(80px + env(safe-area-inset-bottom, 16px));
    }
  }
</style>
