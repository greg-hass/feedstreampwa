<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { RefreshCw } from "lucide-svelte";

  const dispatch = createEventDispatcher();

  let startY = 0;
  let currentY = 0;
  let isPulling = false;
  let isRefreshing = false;

  const PULL_THRESHOLD = 80; // Distance to trigger refresh
  const MAX_PULL = 120; // Maximum pull distance

  $: pullDistance = Math.min(Math.max(currentY - startY, 0), MAX_PULL);
  $: pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  $: shouldRefresh = pullDistance >= PULL_THRESHOLD && !isRefreshing;

  function handleTouchStart(e: TouchEvent) {
    // Only start if we're at the top of the page
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
      isPulling = true;
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isPulling || isRefreshing) return;

    currentY = e.touches[0].clientY;
    const distance = currentY - startY;

    // Only prevent default if pulling down
    if (distance > 0 && window.scrollY === 0) {
      e.preventDefault();
    }
  }

  async function handleTouchEnd() {
    if (!isPulling) return;

    if (shouldRefresh) {
      isRefreshing = true;
      dispatch("refresh");

      // Reset after a minimum time to show the animation
      setTimeout(() => {
        isRefreshing = false;
        isPulling = false;
        startY = 0;
        currentY = 0;
      }, 1000);
    } else {
      isPulling = false;
      startY = 0;
      currentY = 0;
    }
  }
</script>

<svelte:window
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
/>

{#if isPulling || isRefreshing}
  <div
    class="fixed top-[130px] left-0 right-0 flex items-center justify-center z-50 transition-all duration-200"
    style="height: {pullDistance}px; opacity: {pullProgress}"
  >
    <div
      class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30"
      class:animate-spin={isRefreshing}
      style="transform: rotate({pullProgress * 360}deg)"
    >
      <RefreshCw size={20} class="text-white" />
    </div>
  </div>
{/if}

<style>
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
