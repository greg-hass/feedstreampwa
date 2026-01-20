<script lang="ts">
  // Skeleton for settings modal content loading state
  export let tab: 'general' | 'feeds' | 'data' | 'automation' = 'general';
</script>

<div class="skeleton-settings animate-pulse" aria-hidden="true" aria-busy="true" role="status">
  <span class="sr-only">Loading settings...</span>

  {#if tab === 'general'}
    <!-- General Settings Skeleton -->
    <div class="space-y-6">
      <!-- Section -->
      <div class="space-y-4">
        <div class="h-5 w-32 rounded bg-zinc-800" />
        <div class="grid grid-cols-3 gap-3">
          {#each Array(3) as _}
            <div class="h-12 rounded-xl bg-zinc-800/50" />
          {/each}
        </div>
      </div>

      <!-- Section -->
      <div class="space-y-4">
        <div class="h-5 w-28 rounded bg-zinc-800" />
        <div class="flex flex-wrap gap-2">
          {#each Array(6) as _}
            <div class="h-10 w-20 rounded-full bg-zinc-800/50" />
          {/each}
        </div>
      </div>

      <!-- Section -->
      <div class="space-y-4">
        <div class="h-5 w-36 rounded bg-zinc-800" />
        <div class="h-12 w-full rounded-xl bg-zinc-800/50" />
      </div>
    </div>
  {:else if tab === 'feeds'}
    <!-- Feeds Management Skeleton -->
    <div class="space-y-3">
      {#each Array(5) as _}
        <div class="flex items-center gap-3 p-4 rounded-xl bg-zinc-800/30">
          <div class="w-10 h-10 rounded-lg bg-zinc-800" />
          <div class="flex-1 space-y-2">
            <div class="h-4 w-48 rounded bg-zinc-800" />
            <div class="h-3 w-32 rounded bg-zinc-800/50" />
          </div>
          <div class="flex gap-2">
            <div class="w-8 h-8 rounded-lg bg-zinc-800/50" />
            <div class="w-8 h-8 rounded-lg bg-zinc-800/50" />
          </div>
        </div>
      {/each}
    </div>
  {:else if tab === 'data'}
    <!-- Data Settings Skeleton -->
    <div class="space-y-6">
      <!-- OPML Section -->
      <div class="space-y-4">
        <div class="h-5 w-32 rounded bg-zinc-800" />
        <div class="flex gap-3">
          <div class="h-12 flex-1 rounded-xl bg-zinc-800/50" />
          <div class="h-12 flex-1 rounded-xl bg-zinc-800/50" />
        </div>
      </div>

      <!-- Backups Section -->
      <div class="space-y-4">
        <div class="h-5 w-28 rounded bg-zinc-800" />
        <div class="h-12 w-full rounded-xl bg-zinc-800/50" />
        <div class="space-y-2">
          {#each Array(3) as _}
            <div class="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30">
              <div class="h-4 w-40 rounded bg-zinc-800" />
              <div class="h-4 w-24 rounded bg-zinc-800/50" />
            </div>
          {/each}
        </div>
      </div>
    </div>
  {:else if tab === 'automation'}
    <!-- Automation Settings Skeleton -->
    <div class="space-y-6">
      <div class="space-y-4">
        <div class="h-5 w-36 rounded bg-zinc-800" />
        <div class="p-4 rounded-xl bg-zinc-800/30 space-y-3">
          <div class="h-10 w-full rounded-lg bg-zinc-800/50" />
          <div class="flex gap-3">
            <div class="h-10 flex-1 rounded-lg bg-zinc-800/50" />
            <div class="h-10 flex-1 rounded-lg bg-zinc-800/50" />
          </div>
          <div class="h-10 w-24 rounded-lg bg-zinc-800" />
        </div>
      </div>

      <div class="space-y-3">
        <div class="h-5 w-28 rounded bg-zinc-800" />
        {#each Array(3) as _}
          <div class="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30">
            <div class="flex-1 space-y-1">
              <div class="h-4 w-32 rounded bg-zinc-800" />
              <div class="h-3 w-48 rounded bg-zinc-800/50" />
            </div>
            <div class="w-8 h-8 rounded-lg bg-zinc-800/50" />
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  @media (prefers-reduced-motion: reduce) {
    .skeleton-settings {
      animation: none;
    }

    .skeleton-settings > div {
      opacity: 0.7;
    }
  }
</style>
