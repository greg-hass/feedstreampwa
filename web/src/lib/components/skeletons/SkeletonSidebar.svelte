<script lang="ts">
  // Skeleton for sidebar loading state
</script>

<div class="skeleton-sidebar animate-pulse" aria-hidden="true" aria-busy="true">
  <!-- Brand/Logo Skeleton -->
  <div class="p-4 border-b border-zinc-800">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-zinc-800" />
      <div class="flex-1">
        <div class="h-5 w-24 rounded bg-zinc-800 mb-1" />
        <div class="h-3 w-16 rounded bg-zinc-800/50" />
      </div>
    </div>
  </div>

  <!-- Navigation Menu Skeleton -->
  <div class="p-4 space-y-2">
    <div class="h-3 w-16 rounded bg-zinc-800/50 mb-3" />
    {#each Array(3) as _, i}
      <div class="flex items-center gap-3 p-2 rounded-lg">
        <div class="w-5 h-5 rounded bg-zinc-800" />
        <div class="h-4 flex-1 rounded bg-zinc-800" style="width: {70 + Math.random() * 20}%" />
        <div class="w-6 h-5 rounded-full bg-zinc-800/50" />
      </div>
    {/each}
  </div>

  <!-- Smart Folders Skeleton -->
  <div class="p-4 border-t border-zinc-800 space-y-2">
    <div class="h-3 w-24 rounded bg-zinc-800/50 mb-3" />
    {#each Array(4) as _, i}
      <div class="flex items-center gap-3 p-2 rounded-lg">
        <div class="w-5 h-5 rounded bg-zinc-800" />
        <div class="h-4 flex-1 rounded bg-zinc-800" style="width: {50 + Math.random() * 30}%" />
      </div>
    {/each}
  </div>

  <!-- Folders Skeleton -->
  <div class="p-4 border-t border-zinc-800 space-y-2">
    <div class="flex items-center justify-between mb-3">
      <div class="h-3 w-16 rounded bg-zinc-800/50" />
      <div class="w-5 h-5 rounded bg-zinc-800/30" />
    </div>
    {#each Array(3) as _, i}
      <div class="flex items-center gap-3 p-2 rounded-lg pl-4">
        <div class="w-4 h-4 rounded bg-zinc-800" />
        <div class="h-4 flex-1 rounded bg-zinc-800" style="width: {40 + Math.random() * 40}%" />
      </div>
    {/each}
  </div>
</div>

<style>
  .skeleton-sidebar {
    height: 100%;
    background: var(--tw-colors-surface, #18181b);
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-sidebar {
      animation: none;
    }

    .skeleton-sidebar > div {
      opacity: 0.7;
    }
  }
</style>
