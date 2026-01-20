<script lang="ts">
  import { createEventDispatcher } from "svelte";
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

  export let item: Item;
  export let feedType: "rss" | "youtube" | "reddit" | "podcast" = "rss";
  export let density: ViewDensity = "comfortable";
  export let timeAgo: string = ""; // Computed by parent to avoid N subscriptions

  const dispatch = createEventDispatcher();

  // ===== Memoized/cached computations =====
  // Extract YouTube video ID - pure function, no IIFE in reactive
  function extractYouTubeId(externalId: string | null | undefined, url: string | null | undefined): string | null {
    if (externalId) return externalId;
    if (url) {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return null;
  }

  // YouTube thumbnail quality state (mutable for fallback)
  let ytThumbnailQuality = "maxresdefault";

  function handleYouTubeThumbnailError() {
    if (ytThumbnailQuality === "maxresdefault") {
      ytThumbnailQuality = "hqdefault";
    }
  }

  // ===== Consolidated reactive computations =====
  // Single reactive block for item-derived metadata
  $: itemMeta = (() => {
    const youtubeVideoId = extractYouTubeId(item.external_id, item.url);
    const youtubeThumbnail = youtubeVideoId
      ? `https://img.youtube.com/vi/${youtubeVideoId}/${ytThumbnailQuality}.jpg`
      : null;
    const readTime = item.summary ? calculateReadTime(item.summary) : 0;

    return {
      youtubeVideoId,
      youtubeThumbnail,
      thumbnailUrl: youtubeThumbnail ||
        (feedType === "podcast" ? item.feed_icon_url || item.media_thumbnail : item.media_thumbnail),
      readTimeText: readTime > 0 ? formatReadTime(readTime) : null,
      isCached: $offlineArticles.has(item.id),
      showDiversityBadge: $diversitySettings.enabled && (item as ItemWithDiversity)._isDiverseSource,
    };
  })();

  // Single reactive block for podcast-specific metadata
  $: podcastMeta = (() => {
    const isPodcast = feedType === "podcast";
    const durationSeconds = item.media_duration_seconds ?? null;
    const hasDuration = typeof durationSeconds === "number" && durationSeconds > 0;
    const progressSeconds = Math.max(0, item.playback_position || 0);
    const hasProgress = progressSeconds > 5;

    return {
      isPodcast,
      durationSeconds,
      hasDuration,
      progressSeconds,
      hasProgress,
      progressPercent: hasDuration ? Math.min(100, (progressSeconds / durationSeconds) * 100) : 0,
      remainingSeconds: hasDuration ? Math.max(0, durationSeconds - progressSeconds) : null,
      playLabel: isPodcast ? (hasProgress ? "Resume" : "Listen") : "Play",
    };
  })();

  // Density classes - only recomputes when density prop changes
  $: densityClasses = {
    padding: density === "compact" ? "px-4 py-2.5" : density === "spacious" ? "px-4 py-6" : "px-4 py-4",
    iconSize: density === "compact" ? "w-4 h-4" : "w-5 h-5",
    titleSize: density === "compact" ? "text-sm leading-snug" : density === "spacious" ? "text-xl" : "text-base sm:text-lg",
    summarySize: density === "compact" ? "text-xs" : density === "spacious" ? "text-base" : "text-sm",
    spacing: density === "compact" ? "mb-0.5" : density === "spacious" ? "mb-4" : "mb-2",
    headerSpacing: density === "compact" ? "mb-1" : density === "spacious" ? "mb-4" : "mb-3",
    mediaSpacing: density === "compact" ? "mb-1" : density === "spacious" ? "mb-4" : "mb-3",
    feedTextSize: density === "compact" ? "text-xs" : "text-sm",
    metaGap: density === "compact" ? "gap-1.5" : "gap-2",
  };

  // Source styling - static lookup, minimal reactivity
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

  async function handleShare(e: MouseEvent) {
    e.stopPropagation();

    const shareData = {
      title: item.title || "Article from FeedStream",
      text: item.summary
        ? item.summary.replace(/<[^>]*>?/gm, "").substring(0, 200)
        : undefined,
      url: item.url || undefined,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(item.url || "");
        alert("Link copied to clipboard!");
      }
    } catch (err) {
      console.error("Failed to share:", err);
    }
  }

  // Check if item is playable - consolidated into single reactive
  $: playability = (() => {
    const enclosureUrl = typeof item.enclosure === 'string'
      ? item.enclosure
      : (item.enclosure && typeof item.enclosure === 'object' ? item.enclosure.url : null);
    const fallbackAudioUrl = item.url && /\.(mp3|m4a|aac|ogg|opus|wav|flac)(\?|#|$)/i.test(item.url)
      ? item.url : null;
    const isPlayable = (feedType === "podcast" && (enclosureUrl || fallbackAudioUrl || item.url)) ||
      ((enclosureUrl || fallbackAudioUrl) && Boolean(item.enclosure)) ||
      itemMeta.youtubeVideoId;
    return { isPlayable, isSelected: $selectedItemIds.has(item.id) };
  })();

  function handleClick(e: Event) {
    // Clear any pending long-press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // Always open the article on click (selection mode was removed)
    handleOpen();
  }

  // Long press handler for mobile - disabled since we removed selection mode UI
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  function handleTouchStart() {
    // Long press no longer enables selection mode
    // Just track for cancellation purposes
  }

  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
  // Track image loading errors
  let imageError = false;

  function handleImageError() {
    imageError = true;
  }

  // Reset error state when item changes
  $: if (item.id) {
    imageError = false;
  }
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-to-interactive-role -->
<article
  class="group relative flex flex-col md:flex-row {densityClasses.padding} border-b transition-colors cursor-pointer overflow-hidden
  {playability.isSelected
    ? 'bg-blue-500/10 border-blue-500/30'
    : 'border-zinc-800 hover:bg-zinc-900/80 hover:border-zinc-700'}
  {item.is_read === 1 ? 'article-read' : 'article-unread'}"
  on:click={handleClick}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  on:keypress={(e) => e.key === "Enter" && handleClick(e)}
  tabindex="0"
  role="button"
  aria-label={`${item.is_read ? 'Read' : 'Unread'}: ${item.title}`}
>
  <!-- Left Column: Content -->
  <div class="flex-1 min-w-0 flex flex-col">
    <!-- Header: Feed Icon + Feed Title + Timestamp -->
    <div class="flex items-start gap-3 {densityClasses.headerSpacing}">
      <!-- Feed Icon -->
      <div class="flex-shrink-0">
        <div
          class="{densityClasses.iconSize} rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 group-hover:border-zinc-600 transition-colors"
        >
          {#if item.feed_icon_url}
            <img
              src={item.feed_icon_url}
              alt=""
              class="w-5 h-5 object-contain opacity-80"
            />
          {:else}
            <svelte:component
              this={currentStyle.icon}
              size={20}
              class={currentStyle.color}
            />
          {/if}
        </div>
      </div>

      <!-- Feed Title + Timestamp + Read Time -->
      <div
        class="flex-1 min-w-0 flex items-center {densityClasses.metaGap} {densityClasses.feedTextSize} pt-0.5 flex-wrap"
      >
        <span class="font-semibold text-accent truncate max-w-[180px]">{item.feed_title}</span>
        {#if itemMeta.isCached}
          <OfflineBadge size="sm" showText={false} />
        {/if}
        {#if itemMeta.showDiversityBadge}
          <span
            class="px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-[8px] font-semibold text-cyan-400"
            title="New source - explore diverse content">NEW</span
          >
        {/if}
        <span class="text-zinc-600">•</span>
        <span class="text-orange-400 whitespace-nowrap">{timeAgo}</span>
        {#if itemMeta.readTimeText}
          <span class="text-zinc-600">•</span>
          <span class="text-zinc-500 whitespace-nowrap flex items-center gap-1">
            <Clock size={12} />
            {itemMeta.readTimeText}
          </span>
        {/if}
      </div>
    </div>

    <!-- Article Title (Full Width) -->
    <h3
      class="{densityClasses.titleSize} leading-snug transition-colors {densityClasses.spacing} {item.is_read
        ? 'text-zinc-500 font-normal'
        : 'text-white font-semibold'}"
    >
      {#if item.is_read === 0 && density === "compact"}
        <span class="unread-indicator" aria-hidden="true"></span>
      {/if}
      {item.title}
    </h3>

    {#if podcastMeta.isPodcast}
      <div class="flex flex-col gap-2 {densityClasses.spacing}">
        <div class="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
          <span
            class="inline-flex items-center gap-1 rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-zinc-200"
          >
            <Radio size={12} class="text-accent" />
            Podcast
          </span>
          {#if podcastMeta.hasDuration}
            <span class="text-zinc-500">
              {podcastMeta.hasProgress
                ? `${formatDuration(podcastMeta.remainingSeconds)} left`
                : formatDuration(podcastMeta.durationSeconds)}
            </span>
          {:else if podcastMeta.hasProgress}
            <span class="text-zinc-500">
              Resume at {formatDuration(podcastMeta.progressSeconds)}
            </span>
          {/if}
        </div>
        {#if podcastMeta.hasDuration}
          <div class="h-1.5 w-full rounded-full bg-white/5">
            <div
              class="h-full rounded-full bg-accent/80 transition-[width]"
              style="width: {podcastMeta.progressPercent}%"
            ></div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- Actions Bar -->
    <div class="flex items-center justify-between pt-2 mt-auto">
      <div class="flex items-center gap-1 -ml-2">
        <button
          class="touch-target rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center {item.is_read
            ? 'text-emerald-400'
            : 'text-zinc-500 hover:text-white'}"
          on:click={handleRead}
          title={item.is_read ? "Mark as Unread" : "Mark as Read"}
          aria-label={item.is_read ? "Mark as Unread" : "Mark as Read"}
        >
          {#if item.is_read}
            <CheckCircle2 size={20} />
          {:else}
            <div
              class="w-5 h-5 border-2 border-current rounded-full"
            ></div>
          {/if}
        </button>

        <button
          class="touch-target rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center {item.is_starred
            ? 'text-orange-400'
            : 'text-zinc-500 hover:text-white'}"
          on:click={handleStar}
          title="Bookmark"
          aria-label={item.is_starred ? "Remove bookmark" : "Add bookmark"}
        >
          <Bookmark size={20} class={item.is_starred ? "fill-current" : ""} />
        </button>

        {#if playability.isPlayable}
          <button
            class="flex items-center gap-2 px-3 min-h-[44px] rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors border border-zinc-700"
            on:click={handlePlay}
            title={podcastMeta.isPodcast ? (podcastMeta.hasProgress ? "Resume Episode" : "Play Episode") : "Play"}
            aria-label={podcastMeta.isPodcast ? (podcastMeta.hasProgress ? "Resume Episode" : "Play Episode") : "Play video"}
          >
            <PlayCircle size={16} class="fill-current text-accent" />
            <span>{podcastMeta.playLabel}</span>
          </button>
        {/if}

        <button
          class="touch-target rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-blue-400 transition-colors flex items-center justify-center"
          on:click={handleShare}
          title="Share"
          aria-label="Share article"
        >
          <Share2 size={20} />
        </button>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          class="touch-target rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-blue-400 transition-colors flex items-center justify-center"
          on:click|stopPropagation
          title="Open Link"
          aria-label="Open original article in new tab"
        >
          <ExternalLink size={20} />
        </a>
      </div>
    </div>
  </div>

  <!-- Right Column: Media (Thumbnail on Desktop) -->
  {#if itemMeta.youtubeVideoId}
    <!-- YouTube: Full width on mobile/tablet, Thumbnail on desktop -->
    <div
      class="w-full aspect-video md:w-48 md:h-32 md:aspect-auto md:flex-shrink-0 md:ml-4 rounded-xl overflow-hidden bg-black {densityClasses.mediaSpacing} md:mb-0 border border-zinc-800 mt-3 md:mt-0"
      on:click={handlePlay}
      role="button"
      tabindex="0"
      on:keypress={(e) => e.key === "Enter" && handlePlay(e)}
    >
      <div class="relative w-full h-full group/video cursor-pointer">
        <img
          src={itemMeta.youtubeThumbnail}
          alt={item.title}
          class="w-full h-full object-cover"
          loading="lazy"
          on:error={handleYouTubeThumbnailError}
        />
        <div class="absolute inset-0 flex items-center justify-center">
          <!-- Official YouTube-style play button -->
          <div
            class="w-[68px] h-[48px] md:w-[52px] md:h-[36px] scale-100 group-hover/video:scale-110 transition-transform"
          >
            <svg viewBox="0 0 68 48" class="w-full h-full drop-shadow-lg">
              <path
                d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
                fill="#FF0000"
              />
              <path d="M45 24L27 14v20" fill="#FFF" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  {:else if itemMeta.thumbnailUrl && !imageError}
    <!-- Image: Full width on mobile, Thumbnail on desktop -->
    <div
      class="w-full aspect-video sm:aspect-[2/1] md:w-48 md:h-32 md:aspect-auto md:flex-shrink-0 md:ml-4 rounded-xl overflow-hidden bg-zinc-900 {densityClasses.mediaSpacing} md:mb-0 border border-zinc-800 mt-3 md:mt-0"
    >
      <img
        src={itemMeta.thumbnailUrl}
        alt={item.title}
        class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
        loading="lazy"
        on:error={handleImageError}
      />
    </div>
  {/if}
</article>

<style>
  article {
    scroll-margin-top: 80px;
  }

  /* Enhanced read/unread states for visual hierarchy */
  article.article-read {
    opacity: 0.65;
  }

  article.article-read:hover {
    opacity: 0.85;
  }

  article.article-unread {
    opacity: 1;
  }

  /* Unread indicator dot for compact mode */
  .unread-indicator {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tw-colors-accent, #10b981);
    margin-right: 6px;
    vertical-align: middle;
    flex-shrink: 0;
  }
</style>
