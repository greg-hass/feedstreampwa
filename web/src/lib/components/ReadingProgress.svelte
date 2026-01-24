<script lang="ts">
  import { scrollProgress } from "$lib/stores/readerSettings";
  import { onMount, onDestroy } from "svelte";

  export let scrollContainer: HTMLElement | null = null;

  let progress = 0;

  function updateProgress() {
    if (!scrollContainer) return;

    const scrollTop = scrollContainer.scrollTop;
    const scrollHeight =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;

    if (scrollHeight > 0) {
      progress = Math.min(Math.max((scrollTop / scrollHeight) * 100, 0), 100);
      scrollProgress.set(progress);
    }
  }

  onMount(() => {
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", updateProgress);
      updateProgress(); // Initial calculation
    }
  });

  onDestroy(() => {
    if (scrollContainer) {
      scrollContainer.removeEventListener("scroll", updateProgress);
    }
    scrollProgress.set(0);
  });
</script>

<!-- Progress Bar -->
<div class="reading-progress-container">
  <div class="reading-progress-bar" style="width: {progress}%"></div>
</div>

<!-- Progress Percentage (optional, shows on hover) -->
{#if progress > 0}
  <div class="reading-progress-label">
    {Math.round(progress)}%
  </div>
{/if}

<style>
  .reading-progress-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
    z-index: 1000;
  }

  .reading-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #10b981, #3b82f6);
    transition: width 0.1s ease-out;
    box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
  }

  .reading-progress-label {
    position: fixed;
    top: 12px;
    right: 12px;
    padding: 4px 8px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    color: white;
    z-index: 1001;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .reading-progress-container:hover + .reading-progress-label {
    opacity: 1;
  }
</style>
