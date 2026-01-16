<script lang="ts">
  import { refreshState } from "$lib/stores/feeds";
  import { slide } from "svelte/transition";
  import { X, RefreshCw, AlertCircle } from "lucide-svelte";
  import { onMount } from "svelte";

  let errorDismissTimeout: ReturnType<typeof setTimeout> | null = null;
  let dismissed = false;

  function close() {
    dismissed = true;
    if ($refreshState.error) {
      refreshState.update((s) => ({ ...s, error: null }));
    }
    if (errorDismissTimeout) clearTimeout(errorDismissTimeout);
  }

  $: if (!$refreshState.isRefreshing && !$refreshState.error) {
    dismissed = false;
  }

  $: if ($refreshState.error && !errorDismissTimeout) {
    // Auto-dismiss error after 5 seconds
    errorDismissTimeout = setTimeout(() => {
      close();
      errorDismissTimeout = null;
    }, 5000);
  }

  onMount(() => {
    return () => {
      if (errorDismissTimeout) clearTimeout(errorDismissTimeout);
    };
  });
</script>

{#if !dismissed && ($refreshState.isRefreshing || $refreshState.error)}
  <div
    class="fixed left-1/2 -translate-x-1/2 z-[1500] min-w-[320px] max-w-[400px] bottom-toast"
    transition:slide={{ axis: "y" }}
  >
    <div
      class="bg-[#18181b] rounded-2xl
        {$refreshState.error ? 'border border-red-500/30' : 'border border-white/10'}
        shadow-2xl overflow-hidden"
    >
      <!-- Header -->
      <div class="px-5 pt-4 pb-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          {#if $refreshState.error}
            <div
              class="w-8 h-8 rounded-lg bg-red-500/20 border border-red-500/20 flex items-center justify-center"
            >
              <AlertCircle size={16} class="text-red-500" />
            </div>
            <span class="text-sm font-semibold text-white">Refresh Failed</span>
          {:else}
            <div
              class="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 border border-accent/20 flex items-center justify-center"
            >
              <RefreshCw size={16} class="text-accent animate-spin" />
            </div>
            <span class="text-sm font-semibold text-white">Refreshing Feeds</span>
          {/if}
        </div>
        <button
          class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white"
          on:click={close}
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <!-- Progress or Error -->
      <div class="px-5 pb-4 space-y-2">
        {#if $refreshState.error}
          <div class="text-xs text-red-400">
            {$refreshState.error}
          </div>
        {:else}
          <div class="text-xs text-white/40">
            {$refreshState.current} / {$refreshState.total} • {$refreshState.message ||
              "Starting..."}
          </div>
          {#if $refreshState.currentFeedTitle}
            <div
              class="text-xs text-white/60 truncate"
              title={$refreshState.currentFeedTitle}
            >
              Refreshing: {$refreshState.currentFeedTitle}
            </div>
          {/if}
          <div class="h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              class="h-full bg-accent rounded-full transition-all duration-300"
              style="width: {$refreshState.total > 0
                ? ($refreshState.current / $refreshState.total) * 100
                : 0}%"
            ></div>
          </div>
        {/if}
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
