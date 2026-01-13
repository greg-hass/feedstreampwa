<script lang="ts">
  import type { ViewDensity } from "$lib/stores/ui";

  export let density: ViewDensity = "comfortable";

  // Density-aware sizing (matching FeedListItem)
  $: densityClasses = {
    padding:
      density === "compact"
        ? "px-4 py-2"
        : density === "spacious"
          ? "px-4 py-6"
          : "px-4 py-4",
    iconSize:
      density === "compact"
        ? "w-8 h-8"
        : density === "spacious"
          ? "w-14 h-14"
          : "w-10 h-10 sm:w-12 sm:h-12",
    titleHeight:
      density === "compact" ? "h-3" : density === "spacious" ? "h-5" : "h-4",
    summaryHeight:
      density === "compact" ? "h-2" : density === "spacious" ? "h-3" : "h-3",
    spacing:
      density === "compact" ? "mb-1" : density === "spacious" ? "mb-4" : "mb-2",
    headerSpacing:
      density === "compact" ? "mb-1" : density === "spacious" ? "mb-4" : "mb-3",
    mediaHeight:
      density === "compact" ? "h-32" : density === "spacious" ? "h-56" : "h-48",
  };
</script>

<article
  class="group flex flex-col {densityClasses.padding} border-b border-white/5 animate-pulse"
  aria-hidden="true"
>
  <!-- Header: Icon + Feed Title + Timestamp Skeleton -->
  <div class="flex items-start gap-3 {densityClasses.headerSpacing}">
    <!-- Icon Skeleton -->
    <div class="flex-shrink-0">
      <div class="{densityClasses.iconSize} rounded-full bg-white/5" />
    </div>

    <!-- Feed Title + Timestamp Skeleton -->
    <div class="flex-1 min-w-0 flex items-center gap-2 pt-1">
      <div class="w-24 h-3 rounded bg-white/10" />
      <div class="w-1 h-1 rounded-full bg-white/10" />
      <div class="w-16 h-3 rounded bg-white/10" />
    </div>
  </div>

  <!-- Title Skeleton -->
  <div
    class="w-full {densityClasses.titleHeight} rounded bg-white/10 {densityClasses.spacing}"
  />
  <div
    class="w-4/5 {densityClasses.titleHeight} rounded bg-white/10 {densityClasses.spacing}"
  />

  <!-- Media Skeleton (50% chance to show) -->
  {#if Math.random() > 0.5}
    <div
      class="w-full {densityClasses.mediaHeight} rounded-xl bg-white/5 {densityClasses.spacing}"
    />
  {/if}

  <!-- Summary Skeleton -->
  <div class="w-full {densityClasses.summaryHeight} rounded bg-white/5 mb-1" />
  <div
    class="w-3/4 {densityClasses.summaryHeight} rounded bg-white/5 {densityClasses.spacing}"
  />

  <!-- Actions Skeleton -->
  <div class="flex items-center gap-3 pt-3 border-t border-white/5">
    <div class="w-8 h-8 rounded-lg bg-white/5" />
    <div class="w-8 h-8 rounded-lg bg-white/5" />
    <div class="w-8 h-8 rounded-lg bg-white/5" />
    <div class="w-8 h-8 rounded-lg bg-white/5" />
  </div>
</article>

<style>
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
</style>
