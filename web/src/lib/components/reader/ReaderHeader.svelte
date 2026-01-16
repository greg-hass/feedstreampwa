<script lang="ts">
  import { 
    ChevronLeft, 
    ZoomOut, 
    ZoomIn, 
    Trash2, 
    Share, 
    Headphones,
    Loader2
  } from "lucide-svelte";
  import { readerSettings } from "$lib/stores/readerSettings";
  import type { FontSize } from "$lib/types";

  export let handleClose: () => void;
  export let handleDelete: () => Promise<void>;
  export let handleShare: () => Promise<void>;
  export let toggleTTS: () => void;
  export let ttsActive: boolean;

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

<div class="reader-header-new">
  <div class="header-top">
    <button class="back-button" on:click={handleClose}>
      <ChevronLeft size={20} />
      <span>Back</span>
    </button>
  </div>

  <div class="header-controls-row">
    <div class="zoom-controls">
      <button on:click={decreaseFontSize} title="Decrease Font Size">
        <ZoomOut size={18} />
      </button>
      <span class="zoom-level">
        {zoomLabels[$readerSettings.fontSize]}
      </span>
      <button on:click={increaseFontSize} title="Increase Font Size">
        <ZoomIn size={18} />
      </button>
    </div>

    <div class="control-divider"></div>

    <div class="action-buttons">
      <button
        on:click={handleDelete}
        title="Delete Article"
        class="hover:text-red-400 transition-colors"
      >
        <Trash2 size={20} />
      </button>
      <button on:click={handleShare} title="Share">
        <Share size={20} />
      </button>
      <button 
        on:click={toggleTTS} 
        title={ttsActive ? "Stop Listening" : "Listen"}
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
