<script lang="ts">
  import {
    ChevronLeft,
    ChevronUp,
    ChevronDown,
    Type,
    Share,
    Headphones,
    Bookmark,
    Play,
  } from "lucide-svelte";
  import { readerSettings } from "$lib/stores/readerSettings";
  import {
    readerNavigation,
    navigateToPrev,
    navigateToNext,
    currentItem,
  } from "$lib/stores/reader";
  import { toggleStar } from "$lib/stores/items";
  import type { FontSize } from "$lib/types";

  export let handleClose: () => void;
  export let handleShare: () => Promise<void>;
  export let toggleTTS: () => void;
  export let ttsActive: boolean;
  export let isEmbedded = false;

  let showTextSizes = false;
  const fontSizes: FontSize[] = ["small", "medium", "large"];

  function setFontSize(size: FontSize) {
    readerSettings.setFontSize(size);
    showTextSizes = false;
  }

  function handleToggleBookmark() {
    if ($currentItem) {
      toggleStar($currentItem);
    }
  }

  // Keyboard navigation
  function handleKeydown(e: KeyboardEvent) {
    // Only handle if reader is focused and not in an input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;

    if (e.key === "j" || e.key === "ArrowDown") {
      if ($readerNavigation.hasNext) {
        e.preventDefault();
        navigateToNext();
      }
    } else if (e.key === "k" || e.key === "ArrowUp") {
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
    xlarge: "140%",
  };
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="reader-header-new">
  <div class="flex items-center justify-between gap-4">
    <!-- Left: Back -->
    {#if !isEmbedded}
      <button class="back-button" on:click={handleClose}>
        <ChevronLeft size={24} />
        <span class="hidden sm:inline">Back</span>
      </button>
    {:else}
      <div class="w-6 h-6 sm:hidden"></div>
    {/if}

    <!-- Right: Controls -->
    <div class="flex items-center gap-1 sm:gap-2">
      <!-- Article Navigation -->
      {#if $readerNavigation.total > 1}
        <div
          class="flex items-center bg-white/5 rounded-full border border-white/5 px-1 mr-2"
        >
          <button
            class="p-1.5 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity"
            on:click={navigateToPrev}
            disabled={!$readerNavigation.hasPrev}
            title="Previous article"
          >
            <ChevronUp size={18} />
          </button>
          <span
            class="text-[11px] font-bold opacity-40 px-1 min-w-[32px] text-center"
          >
            {$readerNavigation.currentIndex + 1}/{$readerNavigation.total}
          </span>
          <button
            class="p-1.5 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity"
            on:click={navigateToNext}
            disabled={!$readerNavigation.hasNext}
            title="Next article"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      {/if}

      <!-- Text Size Multi-selector -->
      <div class="relative">
        <button
          class="header-action-btn {showTextSizes
            ? 'bg-white/10 text-white'
            : ''}"
          on:click={() => (showTextSizes = !showTextSizes)}
          title="Text Appearance"
        >
          <Type size={20} />
        </button>

        {#if showTextSizes}
          <div
            class="absolute top-full right-0 mt-2 bg-zinc-900 border border-white/10 rounded-2xl p-2 shadow-2xl flex items-center gap-1 z-[100] animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {#each fontSizes as size}
              <button
                class="flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all
                  {$readerSettings.fontSize === size
                  ? 'bg-accent text-zinc-950 font-bold'
                  : 'hover:bg-white/5 text-white/60'}"
                on:click={() => setFontSize(size)}
              >
                <span
                  style="font-size: {size === 'small'
                    ? '12px'
                    : size === 'medium'
                      ? '16px'
                      : '20px'}">A</span
                >
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Bookmark button -->
      <button
        class="header-action-btn"
        on:click={handleToggleBookmark}
        title={$currentItem?.is_starred ? "Remove bookmark" : "Add bookmark"}
      >
        <Bookmark
          size={20}
          class={$currentItem?.is_starred
            ? "fill-emerald-400 text-emerald-400 animate-bookmark-pop"
            : "text-white/60"}
        />
      </button>

      <!-- Share -->
      <button class="header-action-btn" on:click={handleShare} title="Share">
        <Share size={20} />
      </button>

      <!-- TTS -->
      <button
        class="header-action-btn {ttsActive ? 'text-accent bg-accent/10' : ''}"
        on:click={toggleTTS}
        title={ttsActive ? "Stop listening" : "Listen"}
      >
        {#if ttsActive}
          <div class="flex items-center gap-1 px-1">
            <div class="w-1 h-3 bg-current animate-pulse"></div>
            <div class="w-1 h-4 bg-current animate-pulse delay-75"></div>
            <div class="w-1 h-2 bg-current animate-pulse delay-150"></div>
          </div>
        {:else}
          <Headphones size={20} />
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .reader-header-new {
    flex-shrink: 0;
    padding: 14px 24px;
    background: #121212;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 50;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 6px;
    color: white;
    font-size: 15px;
    font-weight: 600;
    background: none;
    border: none;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .back-button:hover {
    transform: translateX(-4px);
  }

  .header-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    transition: all 0.2s;
  }

  .header-action-btn:hover {
    color: white;
    background: rgba(255, 255, 255, 0.08);
  }

  /* Bookmark Pop Animation */
  @keyframes bookmarkPop {
    0% {
      transform: scale(1) rotate(0deg);
    }
    40% {
      transform: scale(1.3) rotate(-15deg);
    }
    60% {
      transform: scale(1.1) rotate(5deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }

  :global(.animate-bookmark-pop) {
    animation: bookmarkPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }
</style>
