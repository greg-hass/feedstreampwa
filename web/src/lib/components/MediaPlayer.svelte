<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    VolumeX,
    Maximize2,
    X,
    ExternalLink,
  } from "lucide-svelte";
  import {
    currentMedia,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    progress,
    formattedCurrentTime,
    formattedDuration,
    mediaType,
    mediaUrl,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    updateProgress,
    stop,
  } from "$lib/stores/media";

  let audioElement: HTMLAudioElement | null = null;
  let progressBarElement: HTMLDivElement | null = null;

  // Sync audio element with store state
  $: if (audioElement) {
    if ($isPlaying) {
      audioElement.play().catch((err) => console.error("Playback error:", err));
    } else {
      audioElement.pause();
    }
  }

  $: if (audioElement) {
    audioElement.volume = $isMuted ? 0 : $volume;
  }

  $: if (audioElement && Math.abs(audioElement.currentTime - $currentTime) > 1) {
    audioElement.currentTime = $currentTime;
  }

  // Audio event handlers
  function handleTimeUpdate() {
    if (audioElement) {
      updateProgress(audioElement.currentTime);
    }
  }

  function handleLoadedMetadata() {
    if (audioElement) {
      duration.set(audioElement.duration);
      // Start from saved position
      if ($currentMedia?.playback_position) {
        audioElement.currentTime = $currentMedia.playback_position;
      }
    }
  }

  function handleEnded() {
    isPlaying.set(false);
    currentTime.set(0);
  }

  function handleError(e: Event) {
    console.error("Media error:", e);
    isPlaying.set(false);
  }

  // Progress bar click handler
  function handleProgressClick(e: MouseEvent) {
    if (!progressBarElement || !$duration) return;

    const rect = progressBarElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * $duration;

    seek(newTime);
    if (audioElement) {
      audioElement.currentTime = newTime;
    }
  }

  // Volume slider
  let volumeSliderElement: HTMLDivElement | null = null;

  function handleVolumeClick(e: MouseEvent) {
    if (!volumeSliderElement) return;

    const rect = volumeSliderElement.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newVolume = Math.max(0, Math.min(1, clickX / rect.width));

    setVolume(newVolume);
    if ($isMuted) {
      isMuted.set(false);
    }
  }

  // Open YouTube video in new tab
  function openYouTube() {
    if ($currentMedia?.external_id) {
      window.open(
        `https://www.youtube.com/watch?v=${$currentMedia.external_id}`,
        "_blank"
      );
    }
  }
</script>

<!-- Hidden audio element for podcast playback -->
{#if $currentMedia && $mediaType === 'audio' && $mediaUrl}
  <audio
    bind:this={audioElement}
    src={$mediaUrl}
    on:timeupdate={handleTimeUpdate}
    on:loadedmetadata={handleLoadedMetadata}
    on:ended={handleEnded}
    on:error={handleError}
    preload="metadata"
  />
{/if}

{#if $currentMedia}
  <div
    class="glass border-t border-white/10 p-3 flex items-center gap-3 md:gap-4 w-full relative z-50"
  >
    <!-- Progress Bar (Top Edge) -->
    <div
      bind:this={progressBarElement}
      class="absolute top-0 left-0 right-0 h-[2px] bg-white/5 cursor-pointer group"
      on:click={handleProgressClick}
      role="slider"
      tabindex="0"
      aria-label="Seek slider"
      aria-valuemin="0"
      aria-valuemax={$duration}
      aria-valuenow={$currentTime}
    >
      <div
        class="h-full bg-accent/80 group-hover:bg-accent transition-all relative"
        style="width: {$progress}%"
      >
        <div
          class="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-custom"
        ></div>
      </div>
    </div>

    <!-- Album Art/Info -->
    <div class="flex items-center gap-3 w-40 md:w-64 flex-shrink-0">
      <div
        class="h-10 w-10 md:h-12 md:w-12 rounded-lg bg-zinc-800 border border-white/10 flex-shrink-0 relative overflow-hidden"
      >
        {#if $currentMedia.media_thumbnail}
          <img
            src={$currentMedia.media_thumbnail}
            alt="Album art"
            class="w-full h-full object-cover"
          />
        {:else}
          <div
            class="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0"
          >
            <Maximize2 size={16} class="text-white/20" />
          </div>
        {/if}
      </div>
      <div class="flex flex-col overflow-hidden min-w-0">
        <span class="text-sm font-medium text-white truncate leading-tight">
          {$currentMedia.title}
        </span>
        <span class="text-xs text-white/50 truncate leading-tight">
          {$currentMedia.author || $currentMedia.feed_title}
        </span>
      </div>
    </div>

    <!-- Controls (Center) -->
    <div class="flex-1 flex justify-center items-center gap-4 md:gap-6">
      <button
        class="text-white/40 hover:text-white transition-colors hidden sm:block"
        disabled
        title="Previous (not implemented)"
      >
        <SkipBack size={20} />
      </button>

      <button
        class="h-9 w-9 md:h-10 md:w-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 hover:bg-gray-200 transition-all shadow-lg shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        on:click={togglePlayPause}
        disabled={!$mediaUrl}
        title={$isPlaying ? "Pause" : "Play"}
      >
        {#if $isPlaying}
          <Pause size={18} class="fill-current" />
        {:else}
          <Play size={18} class="ml-0.5 fill-current" />
        {/if}
      </button>

      <button
        class="text-white/40 hover:text-white transition-colors hidden sm:block"
        disabled
        title="Next (not implemented)"
      >
        <SkipForward size={20} />
      </button>
    </div>

    <!-- Time Display (Hidden on small screens) -->
    <div class="hidden lg:flex items-center gap-1 text-xs text-white/60 w-24">
      <span>{$formattedCurrentTime}</span>
      <span>/</span>
      <span>{$formattedDuration}</span>
    </div>

    <!-- Volume/Misc (Right) -->
    <div class="w-auto md:w-64 flex justify-end items-center gap-3">
      <div class="hidden md:flex items-center gap-2 group mr-2">
        <button
          on:click={toggleMute}
          class="text-white/40 group-hover:text-white transition-colors"
          title={$isMuted ? "Unmute" : "Mute"}
        >
          {#if $isMuted}
            <VolumeX size={16} />
          {:else}
            <Volume2 size={16} />
          {/if}
        </button>
        <div
          bind:this={volumeSliderElement}
          class="w-20 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer"
          on:click={handleVolumeClick}
          role="slider"
          tabindex="0"
          aria-label="Volume"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round($volume * 100)}
        >
          <div
            class="h-full bg-white/80 rounded-full transition-all"
            style="width: {$isMuted ? 0 : $volume * 100}%"
          ></div>
        </div>
      </div>

      <!-- Open in YouTube button for videos -->
      {#if $currentMedia.external_id}
        <button
          class="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
          on:click={openYouTube}
          title="Open in YouTube"
        >
          <ExternalLink size={18} />
        </button>
      {:else}
        <button
          class="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
          on:click={stop}
          title="Close player"
        >
          <X size={18} />
        </button>
      {/if}
    </div>
  </div>
{:else}
  <!-- Empty state when no media is playing -->
  <div
    class="glass border-t border-white/10 p-3 flex items-center justify-center w-full relative z-50 text-white/40 text-sm"
  >
    No media playing
  </div>
{/if}
