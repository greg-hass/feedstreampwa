<script lang="ts">
  // No props needed - just a loading placeholder
</script>

<article
  class="group flex flex-col sm:flex-row gap-3 sm:gap-4 py-4 border-b border-white/5"
  aria-hidden="true"
>
  <!-- Desktop: Thumbnail Skeleton -->
  <div class="hidden sm:flex flex-shrink-0">
    <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white/5 animate-pulse" />
  </div>

  <!-- Content Skeleton -->
  <div class="flex-1 min-w-0 flex flex-col justify-between py-1">
    <!-- Metadata Row Skeleton -->
    <div class="flex items-center gap-2 mb-1.5">
      <div class="w-3 h-3 rounded-full bg-white/10 animate-pulse" />
      <div class="w-20 h-3 rounded bg-white/10 animate-pulse" />
      <div class="w-1 h-1 rounded-full bg-white/10" />
      <div class="w-12 h-3 rounded bg-white/10 animate-pulse" />
    </div>

    <!-- Title Skeleton -->
    <div class="w-full h-4 rounded bg-white/10 animate-pulse mb-1" />
    <div class="w-3/4 h-4 rounded bg-white/10 animate-pulse mb-2" />

    <!-- Summary Skeleton -->
    <div class="hidden sm:block w-full h-3 rounded bg-white/5 animate-pulse mb-1" />
    <div class="hidden sm:block w-2/3 h-3 rounded bg-white/5 animate-pulse" />
  </div>

  <!-- Actions Skeleton -->
  <div class="flex-shrink-0 flex items-center gap-1 py-1">
    <div class="w-9 h-9 rounded-lg bg-white/5 animate-pulse" />
    <div class="w-9 h-9 rounded-lg bg-white/5 animate-pulse" />
    <div class="w-9 h-9 rounded-lg bg-white/5 animate-pulse" />
  </div>
</article>
