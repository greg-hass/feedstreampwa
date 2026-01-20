<script lang="ts">
  import {
    ChevronLeft,
    ChevronUp,
    ChevronDown,
    ZoomOut,
    ZoomIn,
    Trash2,
    Share,
    Headphones,
    Loader2
  } from "lucide-svelte";
  import { readerSettings } from "$lib/stores/readerSettings";
  import { readerNavigation, navigateToPrev, navigateToNext } from "$lib/stores/reader";
  import type { FontSize } from "$lib/types";

  export let handleClose: () => void;
  export let handleDelete: () => Promise<void>;
  export let handleShare: () => Promise<void>;
  export let toggleTTS: () => void;
  export let ttsActive: boolean;

  // Keyboard navigation
  function handleKeydown(e: KeyboardEvent) {
    // Only handle if reader is focused and not in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'j' || e.key === 'ArrowDown') {
      if ($readerNavigation.hasNext) {
        e.preventDefault();
        navigateToNext();
      }
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      if ($readerNavigation.hasPrev) {
        e.preventDefault();
        navigateToPrev();
      }
    }
  }

  function increaseFontSize() {
    const sizes: FontSize[] = ["small", "medium", "large", "xlarge"];
    const currentIndex = sizes.indexOf($readerSettings.fontSize);
    if (currentIndex < sizes.length - 1) {
      readerSettings.setFontSize(sizes[currentIndex + 1]);
    }
  }

  function decreaseFontSize() {
    const sizes: FontSize[] = ["small", "medium", "large", "xlarge"];
    const currentIndex = sizes.indexOf($readerSettings.fontSize);
    if (currentIndex > 0) {
      readerSettings.setFontSize(sizes[currentIndex - 1]);
    }
  }

  const zoomLabels = {
    small: "80%",
    medium: "100%",
    large: "120%",
    xlarge: "140%"
  };
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="reader-header-new">
  <div class="header-top">
    <button class="back-button" on:click={handleClose}>
      <ChevronLeft size={20} />
      <span>Back</span>
    </button>

    <!-- Article Navigation -->
    {#if $readerNavigation.total > 1}
      <div class="nav-controls">
        <button
          class="nav-button"
          on:click={navigateToPrev}
          disabled={!$readerNavigation.hasPrev}
          title="Previous article (k or ↑)"
          aria-label="Go to previous article"
        >
          <ChevronUp size={18} />
        </button>
        <span class="nav-position">
          {$readerNavigation.currentIndex + 1} / {$readerNavigation.total}
        </span>
        <button
          class="nav-button"
          on:click={navigateToNext}
          disabled={!$readerNavigation.hasNext}
          title="Next article (j or ↓)"
          aria-label="Go to next article"
        >
          <ChevronDown size={18} />
        </button>
      </div>
    {/if}
  </div>

  <div class="header-controls-row">
    <div class="zoom-controls">
      <button on:click={decreaseFontSize} title="Decrease Font Size" aria-label="Decrease font size">
        <ZoomOut size={18} />
      </button>
      <span class="zoom-level" aria-live="polite">
        {zoomLabels[$readerSettings.fontSize]}
      </span>
      <button on:click={increaseFontSize} title="Increase Font Size" aria-label="Increase font size">
        <ZoomIn size={18} />
      </button>
    </div>

    <div class="control-divider"></div>

    <div class="action-buttons">
      <button
        on:click={handleDelete}
        title="Delete Article"
        aria-label="Delete article"
        class="hover:text-red-400 transition-colors"
      >
        <Trash2 size={20} />
      </button>
      <button on:click={handleShare} title="Share" aria-label="Share article">
        <Share size={20} />
      </button>
      <button
        on:click={toggleTTS}
        title={ttsActive ? "Stop Listening" : "Listen"}
        aria-label={ttsActive ? "Stop listening" : "Listen to article"}
        class={ttsActive ? "text-accent" : ""}
      >
        <Headphones size={20} />
      </button>
    </div>
  </div>
</div>

<style>
  .reader-header-new {
    flex-shrink: 0;
    padding: 12px 18px;
    background: rgba(8, 10, 14, 0.75);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    z-index: 50;
  }

  .header-top {
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .nav-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .nav-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: transparent;
    border: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    transition: all 0.2s;
  }

  .nav-button:hover:not(:disabled) {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .nav-button:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .nav-position {
    font-size: 12px;
    font-weight: 600;
    min-width: 50px;
    text-align: center;
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 4px;
    color: inherit;
    opacity: 0.7;
    font-size: 14px;
    font-weight: 500;
    background: none;
    border: none;
    padding: 4px 0;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .back-button:hover {
    opacity: 1;
  }

  .header-controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    color: inherit;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .zoom-controls button {
    background: none;
    border: none;
    color: inherit;
    padding: 4px;
    cursor: pointer;
    opacity: 0.7;
    display: flex;
    align-items: center;
  }

  .zoom-controls button:hover {
    opacity: 1;
  }

  .zoom-level {
    font-size: 14px;
    font-weight: 600;
    min-width: 45px;
    text-align: center;
    opacity: 0.85;
  }

  .control-divider {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.12);
  }

  .action-buttons {
    display: flex;
    gap: 12px;
  }

  .action-buttons button {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: inherit;
    padding: 6px;
    cursor: pointer;
    opacity: 0.8;
    border-radius: 999px;
    transition: opacity 0.2s;
  }

  .action-buttons button:hover {
    opacity: 1;
  }

  @media (max-width: 640px) {
    .reader-header-new {
      padding: 10px 12px;
    }

    .header-top {
      margin-bottom: 8px;
    }

    .zoom-controls {
      width: 100%;
      justify-content: space-between;
    }

    .action-buttons {
      width: 100%;
      justify-content: space-between;
    }

    .control-divider {
      display: none;
    }
  }
</style>
