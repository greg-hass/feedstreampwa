<script lang="ts">
  // Skeleton for reader view loading state
</script>

<div class="skeleton-reader animate-pulse" aria-hidden="true" aria-busy="true" role="status">
  <span class="sr-only">Loading article...</span>

  <!-- Hero Section Skeleton -->
  <div class="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden mb-8">
    <div class="p-6 md:p-8">
      <!-- Chips Skeleton -->
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-xl bg-zinc-800" />
        <div class="h-6 w-24 rounded-full bg-zinc-800" />
        <div class="h-6 w-16 rounded-full bg-zinc-800/50" />
      </div>

      <!-- Title Skeleton -->
      <div class="space-y-3 mb-4">
        <div class="h-8 md:h-10 w-full rounded bg-zinc-800" />
        <div class="h-8 md:h-10 w-4/5 rounded bg-zinc-800" />
      </div>

      <!-- Meta Skeleton -->
      <div class="flex items-center gap-3 mb-6">
        <div class="h-4 w-20 rounded bg-zinc-800/50" />
        <div class="w-1 h-1 rounded-full bg-zinc-800" />
        <div class="h-4 w-24 rounded bg-zinc-800/50" />
        <div class="w-1 h-1 rounded-full bg-zinc-800" />
        <div class="h-4 w-16 rounded bg-zinc-800/50" />
      </div>

      <!-- Action Buttons Skeleton -->
      <div class="flex items-center gap-3">
        <div class="h-10 w-28 rounded-full bg-zinc-800" />
        <div class="h-10 w-32 rounded-full bg-zinc-800/50" />
      </div>
    </div>
  </div>

  <!-- Content Body Skeleton -->
  <div class="max-w-3xl mx-auto space-y-6">
    <!-- Paragraph Skeletons -->
    {#each Array(4) as _, i}
      <div class="space-y-3">
        <div class="h-4 w-full rounded bg-zinc-800/50" />
        <div class="h-4 w-full rounded bg-zinc-800/50" />
        <div class="h-4 w-11/12 rounded bg-zinc-800/50" />
        <div class="h-4 w-4/5 rounded bg-zinc-800/50" />
      </div>

      {#if i === 1}
        <!-- Image Skeleton -->
        <div class="h-64 w-full rounded-xl bg-zinc-800/30 my-6" />
      {/if}
    {/each}
  </div>
</div>

<style>
  .skeleton-reader {
    padding: 28px 18px 80px;
  }

  @media (min-width: 769px) {
    .skeleton-reader {
      padding: 36px 48px 90px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-reader {
      animation: none;
    }

    .skeleton-reader > div {
      opacity: 0.7;
    }
  }
</style>
