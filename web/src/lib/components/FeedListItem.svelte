<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";
  import type { Item } from "$lib/types";
  import type { ViewDensity } from "$lib/stores/ui";
  import { calculateReadTime, formatReadTime } from "$lib/utils/readTime";
  import { formatDuration } from "$lib/utils/formatDuration";
  import {
    Bookmark,
    ExternalLink,
    PlayCircle,
    Radio,
    Rss,
    Hash,
    CheckCircle2,
    Clock,
    Share2,
    MoreHorizontal,
    X,
  } from "lucide-svelte";
  import RedditIcon from "$lib/components/icons/RedditIcon.svelte";
  import OfflineBadge from "$lib/components/OfflineBadge.svelte";
  import {
    isSelectionMode,
    selectedItemIds,
    toggleItemSelection,
  } from "$lib/stores/selection";
  import { vibrate, HapticPatterns } from "$lib/utils/haptics";
  import { offlineArticles } from "$lib/stores/offlineArticles";
  import { diversitySettings } from "$lib/stores/diversity";
  import type { ItemWithDiversity } from "$lib/stores/diversity";
  import * as itemsApi from "$lib/api/items";

  export let item: Item;
  export let feedType: "rss" | "youtube" | "reddit" | "podcast" = "rss";
  export let density: ViewDensity = "comfortable";
  export let timeAgo: string = "";

  const dispatch = createEventDispatcher();

  // Inline YouTube player state
  let isInlinePlayerActive = false;
  let inlinePlayerId: string;
  let ytPlayer: any = null;
  let ytProgressInterval: ReturnType<typeof setInterval> | null = null;
  let isMobile = false;

  onMount(() => {
    isMobile = window.innerWidth < 768;
    inlinePlayerId = `yt-inline-${item.id}`;
  });

  function handleInlinePlay(e: Event) {
    e.stopPropagation();
    if (!itemMeta.youtubeVideoId) return;

    isInlinePlayerActive = true;

    // Mark as read when playing
    if (item.is_read === 0) {
      itemsApi.toggleItemRead(item.id, true).catch(console.error);
    }

    // Wait for DOM to update then initialize player
    tick().then(() => {
      initInlineYouTubePlayer();
    });
  }

  function closeInlinePlayer(e?: Event) {
    if (e) e.stopPropagation();
    syncPlaybackPosition();
    stopProgressSync();
    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch (err) {}
      ytPlayer = null;
    }
    isInlinePlayerActive = false;
  }

  function initInlineYouTubePlayer() {
    if (!window.YT) {
      loadYouTubeAPI();
      return;
    }

    const videoId = itemMeta.youtubeVideoId;
    if (!videoId) return;

    const container = document.getElementById(inlinePlayerId);
    if (!container) return;

    const startPos = Math.floor(item.playback_position || 0);

    ytPlayer = new window.YT.Player(inlinePlayerId, {
      height: "100%",
      width: "100%",
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        playsinline: 1,
        modestbranding: 1,
        rel: 0,
        start: startPos,
      },
      events: {
        onStateChange: (event: any) => {
          if (window.YT && event.data === window.YT.PlayerState.PLAYING) {
            startProgressSync();
          } else {
            stopProgressSync();
            syncPlaybackPosition();
          }
        },
      },
    });
  }

  function loadYouTubeAPI() {
    if (window.YT) {
      initInlineYouTubePlayer();
      return;
    }

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (existingScript) {
      // API loading, wait for it
      const checkYT = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkYT);
          initInlineYouTubePlayer();
        }
      }, 100);
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    const originalCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (originalCallback) originalCallback();
      initInlineYouTubePlayer();
    };
  }

  function startProgressSync() {
    if (ytProgressInterval) clearInterval(ytProgressInterval);
    ytProgressInterval = setInterval(syncPlaybackPosition, 5000);
  }

  function stopProgressSync() {
    if (ytProgressInterval) {
      clearInterval(ytProgressInterval);
      ytProgressInterval = null;
    }
  }

  async function syncPlaybackPosition() {
    if (!ytPlayer || !ytPlayer.getCurrentTime || !item) return;
    try {
      const currentTime = ytPlayer.getCurrentTime();
      await itemsApi.updateVideoProgress(item.id, currentTime);
    } catch (e) {
      console.error("Failed to sync playback position:", e);
    }
  }

  onDestroy(() => {
    stopProgressSync();
    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch (e) {}
    }
  });

  function extractYouTubeId(
    externalId: string | null | undefined,
    url: string | null | undefined,
  ): string | null {
    if (externalId) return externalId;
    if (url) {
      const match = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
      );
      if (match) return match[1];
    }
    return null;
  }

  function extractImageFromContent(
    html: string | null | undefined,
  ): string | null {
    if (!html) return null;
    const match = html.match(/<img[^>]+src="([^">]+)"/);
    return match ? match[1] : null;
  }

  let ytThumbnailQuality = "maxresdefault";

  function handleYouTubeThumbnailError() {
    if (ytThumbnailQuality === "maxresdefault") {
      ytThumbnailQuality = "hqdefault";
    }
  }

  $: itemMeta = (() => {
    const youtubeVideoId = extractYouTubeId(item.external_id, item.url);
    const youtubeThumbnail = youtubeVideoId
      ? `https://img.youtube.com/vi/${youtubeVideoId}/${ytThumbnailQuality}.jpg`
      : null;
    const readTime = item.summary ? calculateReadTime(item.summary) : 0;
    const extractedImage = extractImageFromContent(
      item.content || item.summary,
    );

    let thumbUrl =
      youtubeThumbnail ||
      (feedType === "podcast"
        ? item.feed_icon_url || item.media_thumbnail
        : item.media_thumbnail || extractedImage);

    // Filter Reddit placeholders
    if (
      thumbUrl &&
      typeof thumbUrl === "string" &&
      (thumbUrl.toLowerCase() === "self" ||
        thumbUrl.toLowerCase() === "default" ||
        thumbUrl.toLowerCase() === "nsfw" ||
        thumbUrl.toLowerCase() === "none")
    ) {
      thumbUrl = null;
    }

    return {
      youtubeVideoId,
      youtubeThumbnail,
      thumbnailUrl: thumbUrl,
      readTimeText: readTime > 0 ? formatReadTime(readTime) : null,
      isCached: $offlineArticles.has(item.id),
      showDiversityBadge:
        $diversitySettings.enabled &&
        (item as ItemWithDiversity)._isDiverseSource,
    };
  })();

  $: podcastMeta = (() => {
    const isPodcast = feedType === "podcast";
    const durationSeconds = item.media_duration_seconds ?? null;
    const hasDuration =
      typeof durationSeconds === "number" && durationSeconds > 0;
    const progressSeconds = Math.max(0, item.playback_position || 0);
    const hasProgress = progressSeconds > 5;

    return {
      isPodcast,
      durationSeconds,
      hasDuration,
      progressSeconds,
      hasProgress,
      progressPercent: hasDuration
        ? Math.min(100, (progressSeconds / durationSeconds) * 100)
        : 0,
      remainingSeconds: hasDuration
        ? Math.max(0, durationSeconds - progressSeconds)
        : null,
      playLabel: isPodcast ? (hasProgress ? "Resume" : "Listen") : "Play",
    };
  })();

  // Simplified logic: Compact = List (no image), Comfortable = Right Image, Spacious = Top Image (Card)
  $: showImage =
    density !== "compact" && (itemMeta.thumbnailUrl || itemMeta.youtubeVideoId);
  $: isCardLayout = density === "spacious";

  const styles = {
    youtube: { color: "text-red-400", icon: PlayCircle },
    reddit: { color: "text-orange-400", icon: RedditIcon },
    podcast: { color: "text-purple-400", icon: Radio },
    rss: { color: "text-accent", icon: Rss },
  };

  $: currentStyle = styles[feedType] || styles.rss;

  function handleOpen() {
    dispatch("open", { item });
  }

  function handleStar(e: MouseEvent) {
    e.stopPropagation();
    dispatch("toggleStar", { item });
  }

  function handleRead(e: MouseEvent) {
    e.stopPropagation();
    dispatch("toggleRead", { item });
  }

  function handlePlay(e: Event) {
    e.stopPropagation();
    dispatch("play", { item });
  }

  function handleClick(e: Event) {
    handleOpen();
  }

  let imageError = false;
  function handleImageError() {
    imageError = true;
  }

  let lastId = item.id;
  $: if (item.id !== lastId) {
    imageError = false;
    lastId = item.id;
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-to-interactive-role -->
<article
  class="group relative flex w-full overflow-hidden
  {isCardLayout
    ? 'flex-col p-0 bg-surface border border-[#2c2c2e] rounded-2xl mb-4'
    : 'flex-col py-4 px-4 border-b border-[#2c2c2e] last:border-0'}
  {item.is_read ? 'opacity-60' : 'opacity-100'}
  {isInlinePlayerActive ? '' : 'cursor-pointer'}"
  on:click={(e) => !isInlinePlayerActive && handleClick(e)}
  on:keypress={(e) =>
    e.key === "Enter" && !isInlinePlayerActive && handleClick(e)}
  tabindex="0"
  role="button"
>
  <!-- Main row for non-card layout -->
  <div
    class={isCardLayout ? "flex flex-col" : "flex flex-row items-start gap-4"}
  >
    <!-- Image Section (Right side thumbnail for comfortable layout) -->
    {#if showImage && !isInlinePlayerActive && (!itemMeta.youtubeVideoId || !isMobile) && !imageError && itemMeta.thumbnailUrl}
      {#if itemMeta.youtubeVideoId}
        <button
          class="{isCardLayout
            ? 'w-full aspect-video'
            : 'w-24 h-24 md:w-32 md:h-24 flex-shrink-0 order-last'} bg-zinc-900 overflow-hidden relative border-0 p-0 block cursor-pointer"
          class:rounded-xl={!isCardLayout}
          on:click|stopPropagation={handleInlinePlay}
          type="button"
          aria-label="Play video"
        >
          <img
            src={itemMeta.youtubeThumbnail}
            alt=""
            class="w-full h-full object-cover"
            on:error={handleYouTubeThumbnailError}
            decoding="async"
            loading="lazy"
          />
          <div
            class="absolute inset-0 flex items-center justify-center bg-[#09090b]/40"
          >
            <PlayCircle
              size={isCardLayout ? 48 : 32}
              class="text-white drop-shadow-lg opacity-90"
              fill="rgba(255,0,0,0.8)"
            />
          </div>
        </button>
      {:else}
        <div
          class="{isCardLayout
            ? 'w-full aspect-video'
            : 'w-24 h-24 md:w-32 md:h-24 flex-shrink-0 order-last'} bg-zinc-900 overflow-hidden relative"
          class:rounded-xl={!isCardLayout}
          role="presentation"
        >
          <img
            src={itemMeta.thumbnailUrl}
            alt=""
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            on:error={handleImageError}
            decoding="async"
            loading="lazy"
          />
        </div>
      {/if}
    {/if}

    <!-- Content Section -->
    <div class="flex-1 min-w-0 flex flex-col {isCardLayout ? 'p-4' : ''}">
      <!-- Meta Header -->
      <div class="flex items-center gap-2 text-xs mb-1.5">
        {#if item.feed_icon_url}
          <img src={item.feed_icon_url} alt="" class="w-4 h-4 rounded-full" />
        {:else}
          <svelte:component
            this={currentStyle.icon}
            size={14}
            class={currentStyle.color}
          />
        {/if}

        <span class="font-medium text-zinc-300 truncate max-w-[120px]"
          >{item.feed_title}</span
        >
        <span class="text-zinc-600">•</span>
        <span class="text-zinc-500">{timeAgo}</span>
      </div>

      <!-- Title -->
      <h3
        class="{isCardLayout
          ? 'text-xl'
          : 'text-[17px]'} font-bold leading-tight text-balance text-white mb-2 tracking-tight"
      >
        {item.title}
      </h3>

      <!-- YouTube Video Section (Mobile) -->
      {#if itemMeta.youtubeVideoId && isMobile}
        <div
          class="mt-2 mb-3 relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-lg"
          on:click|stopPropagation
          role="presentation"
        >
          {#if isInlinePlayerActive}
            <div id={inlinePlayerId} class="absolute inset-0"></div>
            <button
              class="absolute -top-2 -right-2 z-20 p-1.5 bg-[#121212] rounded-full border border-[#2c2c2e] text-white shadow-xl"
              on:click={closeInlinePlayer}
            >
              <X size={14} />
            </button>
          {:else}
            <button
              class="w-full h-full relative group/yt"
              on:click={handleInlinePlay}
            >
              <img
                src={itemMeta.youtubeThumbnail}
                alt=""
                class="w-full h-full object-cover"
                on:error={handleYouTubeThumbnailError}
              />
              <div
                class="absolute inset-0 flex items-center justify-center bg-[#09090b]/40 group-hover/yt:bg-[#09090b]/60 transition-colors"
              >
                <div
                  class="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-2xl"
                >
                  <PlayCircle
                    size={28}
                    class="text-white ml-1"
                    fill="currentColor"
                  />
                </div>
              </div>
            </button>
          {/if}
        </div>
      {/if}

      <!-- Summary / Snippet (Card only or if no image) -->
      {#if (isCardLayout || !showImage) && item.summary && density !== "compact" && !isInlinePlayerActive && (!itemMeta.youtubeVideoId || !isMobile)}
        <p class="text-sm text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
          {item.summary.replace(/<[^>]*>?/gm, "")}
        </p>
      {/if}

      <!-- Footer Actions -->
      <div class="mt-auto flex items-center justify-between pt-1">
        <div class="flex items-center gap-4 text-zinc-500">
          {#if itemMeta.readTimeText && !isInlinePlayerActive}
            <span class="text-xs flex items-center gap-1 font-medium">
              <Clock size={12} />
              {itemMeta.readTimeText}
            </span>
          {/if}
        </div>

        <!-- Quick Actions (Moved to Footer) -->
        {#if !isInlinePlayerActive}
          <div class="flex items-center gap-1">
            <button
              class="p-2 rounded-xl text-zinc-400 hover:text-white transition-all duration-200"
              on:click={handleStar}
              title="Bookmark"
            >
              <Bookmark
                size={18}
                class={item.is_starred
                  ? "fill-emerald-400 text-emerald-400 animate-bookmark-pop"
                  : ""}
              />
            </button>

            <button
              class="p-2 rounded-xl text-zinc-500 hover:text-emerald-500 transition-all duration-200"
              on:click={handleRead}
              title="Mark read"
            >
              {#if item.is_read}
                <CheckCircle2 size={18} class="text-emerald-500" />
              {:else}
                <div
                  class="w-4 h-4 rounded-full border-2 border-zinc-500 hover:border-emerald-500"
                ></div>
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Inline YouTube Player (Desktop only here, Mobile moved above) -->
  {#if isInlinePlayerActive && itemMeta.youtubeVideoId && !isMobile}
    <div class="mt-3 relative">
      <!-- Close button -->
      <button
        class="absolute -top-2 -right-2 z-10 p-1.5 bg-zinc-900 rounded-full border border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shadow-lg"
        on:click={closeInlinePlayer}
        title="Close video"
      >
        <X size={16} />
      </button>

      <!-- Video container -->
      <div
        class="relative w-full rounded-xl overflow-hidden bg-black"
        style="padding-bottom: 56.25%;"
      >
        <div id={inlinePlayerId} class="absolute inset-0"></div>
      </div>
    </div>
  {/if}
</article>

<style>
  /* No special styles needed, utility first */

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
