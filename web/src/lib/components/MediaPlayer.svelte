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
    playbackSpeed,
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
    skip,
    setPlaybackSpeed,
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

  $: if (
    audioElement &&
    Math.abs(audioElement.currentTime - $currentTime) > 1
  ) {
    audioElement.currentTime = $currentTime;
  }

  $: if (audioElement) {
    audioElement.playbackRate = $playbackSpeed;
  }

  $: if (audioElement) {
    const media = audioElement as any;
    if (typeof media.preservesPitch !== "undefined") {
      media.preservesPitch = true;
    }
    if (typeof media.webkitPreservesPitch !== "undefined") {
      media.webkitPreservesPitch = true;
    }
    if (typeof media.mozPreservesPitch !== "undefined") {
      media.mozPreservesPitch = true;
    }
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
        audioElement.currentTime = Math.min(
          $currentMedia.playback_position,
          audioElement.duration || $currentMedia.playback_position
        );
      }
      if ($isPlaying) {
        audioElement.play().catch((err) => console.error("Playback error:", err));
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

  function updateCurrentTime(newTime: number) {
    if (!$duration) return;
    const clampedTime = Math.max(0, Math.min($duration, newTime));
    seek(clampedTime);
    if (audioElement) {
      audioElement.currentTime = clampedTime;
    }
  }

  function handleProgressKeydown(e: KeyboardEvent) {
    if (!$duration) return;
    const step = 5;
    let nextTime = $currentTime;
    let handled = true;

    switch (e.key) {
      case "ArrowRight":
        nextTime += step;
        break;
      case "ArrowLeft":
        nextTime -= step;
        break;
      case "Home":
        nextTime = 0;
        break;
      case "End":
        nextTime = $duration;
        break;
      default:
        handled = false;
    }

    if (!handled) return;
    e.preventDefault();
    updateCurrentTime(nextTime);
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

  function handleVolumeKeydown(e: KeyboardEvent) {
    const step = 0.05;
    let nextVolume = $volume;
    let handled = true;

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        nextVolume += step;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        nextVolume -= step;
        break;
      case "Home":
        nextVolume = 0;
        break;
      case "End":
        nextVolume = 1;
        break;
      default:
        handled = false;
    }

    if (!handled) return;
    e.preventDefault();
    setVolume(nextVolume);
    if ($isMuted && nextVolume > 0) {
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

  function openEpisode() {
    if ($currentMedia?.url) {
      window.open($currentMedia.url, "_blank");
    }
  }

  function handleTogglePlayback() {
    if (!audioElement) {
      togglePlayPause();
      return;
    }

    if ($isPlaying) {
      audioElement.pause();
      isPlaying.set(false);
    } else {
      audioElement
        .play()
        .then(() => isPlaying.set(true))
        .catch((err) => {
          console.error("Playback error:", err);
          isPlaying.set(false);
        });
    }
  }
</script>

<!-- Hidden audio element for podcast playback -->
{#if $currentMedia && $mediaType === "audio" && $mediaUrl}
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

{#if $currentMedia && $mediaType !== "video"}
  <div
    class="bg-[#0b0d11] border-t border-zinc-800 p-3 flex items-center gap-3 md:gap-4 w-full relative z-50 transition-all duration-300"
  >
    <!-- Progress Bar (Top Edge) -->
    <div
      bind:this={progressBarElement}
      class="absolute top-0 left-0 right-0 h-[3px] bg-white/10 cursor-pointer group"
      on:click={handleProgressClick}
      on:keydown={handleProgressKeydown}
      role="slider"
      tabindex="0"
      aria-label="Seek slider"
      aria-valuemin="0"
      aria-valuemax={$duration}
      aria-valuenow={$currentTime}
    >
      <div
        class="h-full bg-accent transition-all relative"
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
        {:else if $currentMedia.feed_icon_url}
          <img
            src={$currentMedia.feed_icon_url}
            alt="Show artwork"
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
        class="text-white/40 hover:text-white transition-colors"
        on:click={() => skip(-10)}
        title="Skip back 10s"
      >
        <SkipBack size={20} />
      </button>

      <button
        class="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 hover:bg-gray-200 transition-all shadow-lg shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        on:click={handleTogglePlayback}
        disabled={!$mediaUrl}
        title={$isPlaying ? "Pause" : "Play"}
      >
        {#if $isPlaying}
          <Pause size={20} class="fill-current" />
        {:else}
          <Play size={20} class="ml-0.5 fill-current" />
        {/if}
      </button>

      <button
        class="text-white/40 hover:text-white transition-colors"
        on:click={() => skip(30)}
        title="Skip forward 30s"
      >
        <SkipForward size={20} />
      </button>
    </div>

    <!-- Speed Selector -->
    <div class="hidden sm:flex items-center gap-1 bg-white/5 rounded-lg p-1">
      {#each [1, 1.25, 1.5, 2] as speed}
        <button
          class="px-2 py-1 text-[10px] font-bold rounded-md transition-colors {$playbackSpeed ===
          speed
            ? 'bg-accent text-bg0'
            : 'text-white/40 hover:text-white hover:bg-white/5'}"
          on:click={() => setPlaybackSpeed(speed)}
        >
          {speed}x
        </button>
      {/each}
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
          on:keydown={handleVolumeKeydown}
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

      {#if $currentMedia?.url}
        <button
          class="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
          on:click={openEpisode}
          title="Open episode page"
        >
          <ExternalLink size={18} />
        </button>
      {/if}

      <!-- Close Button -->
      <button
        class="text-white/40 hover:text-red-400 transition-colors p-2 hover:bg-red-500/10 rounded-full"
        on:click={stop}
        title="Stop & Close"
      >
        <X size={20} />
      </button>
    </div>
  </div>
{:else}
  <!-- Empty state when no media is playing -->
  <div
    class="bg-[#0b0d11] border-t border-zinc-800 p-3 flex items-center justify-center w-full relative z-50 text-white/50 text-sm"
  >
    No media playing
  </div>
{/if}
