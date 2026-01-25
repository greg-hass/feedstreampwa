<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { CheckCircle2, Bookmark } from "lucide-svelte";
  import {
    SWIPE_THRESHOLD,
    MAX_SWIPE,
    INTENT_THRESHOLD,
  } from "$lib/constants/gestures";

  // Less sensitive thresholds
  const S_THRESHOLD = SWIPE_THRESHOLD * 1.5; // 180px
  const I_THRESHOLD = INTENT_THRESHOLD * 2.5; // 62.5px

  const dispatch = createEventDispatcher();

  let startX = 0;
  let currentX = 0;
  let isSwiping = false;
  let swipeDirection: "left" | "right" | null = null;

  $: swipeDistance = isSwiping
    ? Math.max(Math.min(currentX - startX, MAX_SWIPE), -MAX_SWIPE)
    : 0;
  $: swipeProgress = Math.abs(swipeDistance) / S_THRESHOLD;
  $: shouldTrigger = Math.abs(swipeDistance) >= S_THRESHOLD;

  $: backgroundColor = (() => {
    if (!isSwiping) return "transparent";
    if (swipeDistance > 0) return `rgba(59, 130, 246, ${swipeProgress * 0.4})`; // Blue for Read
    if (swipeDistance < 0) return `rgba(16, 185, 129, ${swipeProgress * 0.4})`; // Emerald for Bookmark
    return "transparent";
  })();

  let startY = 0;
  let isScrolling = false;
  let touchStarted = false;

  function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    touchStarted = true;
    isScrolling = false;
    isSwiping = false; // Don't assume swipe yet
    swipeDirection = null;
    currentX = startX;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!touchStarted || isScrolling) return;

    const newX = e.touches[0].clientX;
    const newY = e.touches[0].clientY;

    const diffX = newX - startX;
    const diffY = newY - startY;

    // Determine scrolling vs swiping intent early
    if (
      !swipeDirection &&
      (Math.abs(diffX) > I_THRESHOLD || Math.abs(diffY) > I_THRESHOLD)
    ) {
      // If vertical movement is greater than horizontal, it's a scroll
      if (Math.abs(diffY) > Math.abs(diffX) * 1.5) {
        // Bias towards scrolling (vertical)
        isScrolling = true;
        touchStarted = false;
        return;
      }

      // Otherwise it's a horizontal swipe
      swipeDirection = diffX > 0 ? "right" : "left";
      isSwiping = true;
    }

    // Only update position if we're actively swiping
    if (isSwiping && swipeDirection) {
      currentX = newX;
      if (e.cancelable) e.preventDefault();
    }
  }

  function handleTouchEnd() {
    if (!touchStarted) return;

    if (isSwiping && shouldTrigger) {
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

    // Reset all state
    touchStarted = false;
    isSwiping = false;
    isScrolling = false;
    startX = 0;
    startY = 0;
    currentX = 0;
    swipeDirection = null;
  }

  function handleMouseDown(e: MouseEvent) {
    // Only on mobile-sized screens
    if (window.innerWidth > 768) return;

    startX = e.clientX;
    isSwiping = false; // Wait for movement
    swipeDirection = null;
  }

  function handleMouseMove(e: MouseEvent) {
    // Mouse move tracking logic to mirror touch logic...
    if (e.buttons !== 1) return; // Only if left button is held

    const newX = e.clientX;
    const diffX = newX - startX;

    if (!isSwiping && Math.abs(diffX) > I_THRESHOLD) {
      isSwiping = true;
      swipeDirection = diffX > 0 ? "right" : "left";
    }

    if (isSwiping) {
      currentX = newX;
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
      <div
        class="swipe-indicator left"
        style="opacity: {swipeProgress}; transform: translateX({Math.min(
          0,
          swipeDistance - 80,
        )}px)"
      >
        <CheckCircle2 size={24} class="text-blue-400" />
        <span class="text-sm font-bold text-blue-400 uppercase tracking-tighter"
          >Read</span
        >
      </div>
    {:else if isSwiping && swipeDistance < 0}
      <!-- Bookmark indicator (left swipe) -->
      <div
        class="swipe-indicator right"
        style="opacity: {swipeProgress}; transform: translateX({Math.max(
          0,
          swipeDistance + 80,
        )}px)"
      >
        <span
          class="text-sm font-bold text-emerald-400 uppercase tracking-tighter"
          >Save</span
        >
        <Bookmark size={24} class="text-emerald-400" />
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
    background: #121212;
    will-change: transform;
    z-index: 1;
  }
</style>
