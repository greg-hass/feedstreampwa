<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { CheckCircle2, Bookmark } from "lucide-svelte";

  const dispatch = createEventDispatcher();

  let startX = 0;
  let currentX = 0;
  let isSwiping = false;
  let swipeDirection: "left" | "right" | null = null;

  const SWIPE_THRESHOLD = 100;
  const MAX_SWIPE = 150;

  $: swipeDistance = isSwiping
    ? Math.max(Math.min(currentX - startX, MAX_SWIPE), -MAX_SWIPE)
    : 0;
  $: swipeProgress = Math.abs(swipeDistance) / SWIPE_THRESHOLD;
  $: shouldTrigger = Math.abs(swipeDistance) >= SWIPE_THRESHOLD;

  $: backgroundColor = (() => {
    if (!isSwiping) return "transparent";
    if (swipeDistance > 0) return `rgba(16, 185, 129, ${swipeProgress * 0.3})`;
    if (swipeDistance < 0) return `rgba(251, 146, 60, ${swipeProgress * 0.3})`;
    return "transparent";
  })();

  let startY = 0;
  let isScrolling = false;

  function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = true;
    isScrolling = false;
    swipeDirection = null;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isSwiping || isScrolling) return;

    currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;

    const diffX = currentX - startX;
    const diffY = currentY - startY;

    // Determine scrolling vs swiping intent early
    if (!swipeDirection && (Math.abs(diffX) > 5 || Math.abs(diffY) > 5)) {
      // If vertical movement is greater than horizontal, it's a scroll
      if (Math.abs(diffY) > Math.abs(diffX)) {
        isScrolling = true;
        isSwiping = false; // Cancel swiping for this interaction
        return;
      }

      // Otherwise it's a swipe
      swipeDirection = diffX > 0 ? "right" : "left";
    }

    // Only process swipe if we are definitely swiping horizontal
    if (swipeDirection) {
      // Prevent default only if we are significantly moving horizontally (prevent browser back/forward gestures if needed)
      // But mainly to stop the page from scrolling while we drag the item
      if (e.cancelable) e.preventDefault();
    }
  }

  function handleTouchEnd() {
    if (!isSwiping) return;

    if (shouldTrigger) {
      // Trigger haptic feedback if supported
      if ("vibrate" in navigator) {
        navigator.vibrate(10);
      }

      // Dispatch appropriate action
      if (swipeDistance > 0) {
        dispatch("markRead");
      } else {
        dispatch("toggleBookmark");
      }
    }

    // Reset
    isSwiping = false;
    startX = 0;
    currentX = 0;
    swipeDirection = null;
  }

  function handleMouseDown(e: MouseEvent) {
    // Only on mobile-sized screens
    if (window.innerWidth > 768) return;

    startX = e.clientX;
    isSwiping = true;
    swipeDirection = null;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isSwiping) return;

    currentX = e.clientX;
    const distance = currentX - startX;

    if (!swipeDirection && Math.abs(distance) > 10) {
      swipeDirection = distance > 0 ? "right" : "left";
    }
  }

  function handleMouseUp() {
    if (!isSwiping) return;

    if (shouldTrigger) {
      if (swipeDistance > 0) {
        dispatch("markRead");
      } else {
        dispatch("toggleBookmark");
      }
    }

    isSwiping = false;
    startX = 0;
    currentX = 0;
    swipeDirection = null;
  }
</script>

<div
  class="swipeable-container"
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  role="none"
>
  <!-- Background indicators -->
  <div class="swipe-background" style="background-color: {backgroundColor}">
    {#if isSwiping && swipeDistance > 0}
      <!-- Mark as Read indicator (right swipe) -->
      <div class="swipe-indicator left" style="opacity: {swipeProgress}">
        <CheckCircle2 size={24} class="text-emerald-400" />
        <span class="text-sm font-semibold text-emerald-400">Mark Read</span>
      </div>
    {:else if isSwiping && swipeDistance < 0}
      <!-- Bookmark indicator (left swipe) -->
      <div class="swipe-indicator right" style="opacity: {swipeProgress}">
        <span class="text-sm font-semibold text-orange-400">Bookmark</span>
        <Bookmark size={24} class="text-orange-400" />
      </div>
    {/if}
  </div>

  <!-- Content -->
  <div
    class="swipe-content"
    style="transform: translateX({swipeDistance}px); transition: {isSwiping
      ? 'none'
      : 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'}"
  >
    <slot />
  </div>
</div>

<style>
  .swipeable-container {
    position: relative;
    overflow: hidden;
    touch-action: pan-y; /* Allow vertical scrolling */
  }

  .swipe-background {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    transition: background-color 0.2s;
  }

  .swipe-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;
  }

  .swipe-indicator.left {
    margin-left: 0;
  }

  .swipe-indicator.right {
    margin-left: auto;
  }

  .swipe-content {
    position: relative;
    background: var(--background);
    will-change: transform;
  }
</style>
