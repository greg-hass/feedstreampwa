<script lang="ts">
  import {
    readerSettings,
    isSpeaking,
    type FontSize,
    type FontFamily,
    type ReadingWidth,
  } from "$lib/stores/readerSettings";
  import {
    Type,
    AlignLeft,
    Volume2,
    VolumeX,
    Minus,
    Plus,
  } from "lucide-svelte";

  let showControls = false;
  let speechSynthesis: SpeechSynthesis | null = null;
  let currentUtterance: SpeechSynthesisUtterance | null = null;

  export let content: string = "";
  export let readTime: number = 0;

  $: if (typeof window !== "undefined") {
    speechSynthesis = window.speechSynthesis;
  }

  function cycleFontSize() {
    const sizes: FontSize[] = ["small", "medium", "large", "xlarge"];
    const currentIndex = sizes.indexOf($readerSettings.fontSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    readerSettings.setFontSize(sizes[nextIndex]);
  }

  function cycleFontFamily() {
    const families: FontFamily[] = ["sans", "serif", "mono"];
    const currentIndex = families.indexOf($readerSettings.fontFamily);
    const nextIndex = (currentIndex + 1) % families.length;
    readerSettings.setFontFamily(families[nextIndex]);
  }

  function cycleReadingWidth() {
    const widths: ReadingWidth[] = ["narrow", "medium", "wide"];
    const currentIndex = widths.indexOf($readerSettings.readingWidth);
    const nextIndex = (currentIndex + 1) % widths.length;
    readerSettings.setReadingWidth(widths[nextIndex]);
  }

  function toggleTextToSpeech() {
    if (!speechSynthesis) return;

    if ($isSpeaking) {
      speechSynthesis.cancel();
      isSpeaking.set(false);
      currentUtterance = null;
    } else {
      // Strip HTML and read the text
      const text = content
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) return;

      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.rate = 1.0;
      currentUtterance.pitch = 1.0;
      currentUtterance.volume = 1.0;

      currentUtterance.onend = () => {
        isSpeaking.set(false);
        currentUtterance = null;
      };

      currentUtterance.onerror = () => {
        isSpeaking.set(false);
        currentUtterance = null;
      };

      speechSynthesis.speak(currentUtterance);
      isSpeaking.set(true);
    }
  }

  $: fontSizeLabel = {
    small: "S",
    medium: "M",
    large: "L",
    xlarge: "XL",
  }[$readerSettings.fontSize];

  $: fontFamilyLabel = {
    sans: "Sans",
    serif: "Serif",
    mono: "Mono",
  }[$readerSettings.fontFamily];

  $: widthLabel = {
    narrow: "Narrow",
    medium: "Medium",
    wide: "Wide",
  }[$readerSettings.readingWidth];
</script>

<div class="reader-controls">
  <!-- Read Time Badge -->
  {#if readTime > 0}
    <div class="read-time-badge">
      <span class="text-xs font-semibold text-white/60">
        {readTime} min read
      </span>
    </div>
  {/if}

  <!-- Controls Toggle -->
  <button
    class="control-btn"
    on:click={() => (showControls = !showControls)}
    title="Reader Settings"
  >
    <Type size={18} />
  </button>

  <!-- Controls Panel -->
  {#if showControls}
    <div class="controls-panel">
      <!-- Font Size -->
      <button
        class="control-option"
        on:click={cycleFontSize}
        title="Font Size: {fontSizeLabel}"
      >
        <div class="flex items-center gap-2">
          <Type size={16} />
          <span class="text-sm font-medium">Size</span>
        </div>
        <span class="text-xs font-bold text-purple-400">{fontSizeLabel}</span>
      </button>

      <!-- Font Family -->
      <button
        class="control-option"
        on:click={cycleFontFamily}
        title="Font: {fontFamilyLabel}"
      >
        <div class="flex items-center gap-2">
          <Type size={16} />
          <span class="text-sm font-medium">Font</span>
        </div>
        <span class="text-xs font-bold text-blue-400">{fontFamilyLabel}</span>
      </button>

      <!-- Reading Width -->
      <button
        class="control-option"
        on:click={cycleReadingWidth}
        title="Width: {widthLabel}"
      >
        <div class="flex items-center gap-2">
          <AlignLeft size={16} />
          <span class="text-sm font-medium">Width</span>
        </div>
        <span class="text-xs font-bold text-cyan-400">{widthLabel}</span>
      </button>

      <!-- Text to Speech -->
      {#if speechSynthesis}
        <button
          class="control-option"
          on:click={toggleTextToSpeech}
          title={$isSpeaking ? "Stop Reading" : "Read Aloud"}
        >
          <div class="flex items-center gap-2">
            {#if $isSpeaking}
              <VolumeX size={16} class="text-red-400" />
            {:else}
              <Volume2 size={16} />
            {/if}
            <span class="text-sm font-medium">
              {$isSpeaking ? "Stop" : "Read Aloud"}
            </span>
          </div>
          {#if $isSpeaking}
            <div class="w-2 h-2 rounded-full bg-red-400 animate-pulse"></div>
          {/if}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .reader-controls {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .read-time-badge {
    padding: 4px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .control-btn {
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .controls-panel {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: #18181b;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    padding: 8px;
    min-width: 200px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    z-index: 100;
    animation: slideDown 0.2s ease-out;
  }

  .control-option {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: white;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .control-option:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

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
