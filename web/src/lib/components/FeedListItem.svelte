<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Item } from "$lib/types";
  import type { ViewDensity } from "$lib/stores/ui";
  import { calculateReadTime, formatReadTime } from "$lib/utils/readTime";
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
  import { now } from "$lib/stores/clock";

  export let item: Item;
  export let feedType: "rss" | "youtube" | "reddit" | "podcast" = "rss";
  export let density: ViewDensity = "comfortable";

  const dispatch = createEventDispatcher();

  // Cast to diversity-aware item
  $: diversityItem = item as ItemWithDiversity;
  $: showDiversityBadge =
    $diversitySettings.enabled && diversityItem._isDiverseSource;

  // Check if this article is cached for offline
  $: isCached = $offlineArticles.has(item.id);

  // Calculate read time
  $: readTime = item.summary ? calculateReadTime(item.summary) : 0;
  $: readTimeText = readTime > 0 ? formatReadTime(readTime) : null;

  // Density-aware sizing
  $: densityClasses = {
    padding:
      density === "compact"
        ? "px-4 py-2"
        : density === "spacious"
          ? "px-4 py-6"
          : "px-4 py-4",
    iconSize: "w-5 h-5", // Fixed 20px regardless of density
    titleSize:
      density === "compact"
        ? "text-sm"
        : density === "spacious"
          ? "text-xl"
          : "text-base sm:text-lg",
    summarySize:
      density === "compact"
        ? "text-xs"
        : density === "spacious"
          ? "text-base"
          : "text-sm",
    spacing:
      density === "compact" ? "mb-1" : density === "spacious" ? "mb-4" : "mb-2",
    headerSpacing:
      density === "compact" ? "mb-1" : density === "spacious" ? "mb-4" : "mb-3",
    mediaSpacing:
      density === "compact" ? "mb-1" : density === "spacious" ? "mb-4" : "mb-3",
  };

  // Extract YouTube video ID from external_id or URL
  $: youtubeVideoId = (() => {
    if (item.external_id) return item.external_id;
    if (item.url) {
      const match = item.url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
      );
      if (match) return match[1];
    }
    return null;
  })();

  // YouTube thumbnail URL - try highest quality first, fallback on error
  // maxresdefault (1280x720) → hqdefault (480x360)
  let ytThumbnailQuality = "maxresdefault";
  $: youtubeThumbnail = youtubeVideoId
    ? `https://img.youtube.com/vi/${youtubeVideoId}/${ytThumbnailQuality}.jpg`
    : null;

  function handleYouTubeThumbnailError() {
    if (ytThumbnailQuality === "maxresdefault") {
      ytThumbnailQuality = "hqdefault"; // Fallback to 480x360
    }
  }

  // Use YouTube thumbnail if available, otherwise use media_thumbnail.
  // For podcasts, fallback to feed icon (usually high-res cover art) if no episode image.
  $: thumbnailUrl =
    youtubeThumbnail ||
    item.media_thumbnail ||
    (feedType === "podcast" ? item.feed_icon_url : null);

  // Format Date
  const dateFormatterWithYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const dateFormatterNoYear = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  let dateStr = "";
  let timeAgo = "";
  let itemDate: Date | null = null;

  $: itemDate = new Date(item.published || item.created_at);

  $: {
    if (!itemDate || isNaN(itemDate.getTime())) {
      dateStr = "";
      timeAgo = "";
    } else {
      const nowDate = new Date($now);
      const isCurrentYear = itemDate.getFullYear() === nowDate.getFullYear();
      dateStr = (isCurrentYear ? dateFormatterNoYear : dateFormatterWithYear).format(
        itemDate
      );
      timeAgo = getTimeAgo(itemDate, $now, dateStr);
    }
  }

  function getTimeAgo(date: Date, nowMs: number, fallback: string): string {
    const seconds = Math.floor((nowMs - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return fallback;
  }

  // Source Styling
  const styles = {
    youtube: {
      color: "text-red-400",
      icon: PlayCircle,
    },
    reddit: {
      color: "text-orange-400",
      icon: RedditIcon,
    },
    podcast: {
      color: "text-purple-400",
      icon: Radio,
    },
    rss: {
      color: "text-accent",
      icon: Rss,
    },
  };

  $: currentStyle = styles[feedType] || styles.rss;
  $: Icon = currentStyle.icon;

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

  // Check if item is playable (podcast or video)
  // Strictly require enclosure URL for podcasts/audio
  $: enclosureUrl = typeof item.enclosure === 'string' 
    ? item.enclosure 
    : (item.enclosure && typeof item.enclosure === 'object' ? item.enclosure.url : null);

  $: isPlayable =
    (enclosureUrl &&
      (feedType === "podcast" || Boolean(item.enclosure))) ||
    youtubeVideoId;

  $: isSelected = $selectedItemIds.has(item.id);

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
  let longPressTimer: any = null;

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

<article
  class="group relative flex flex-col md:flex-row {densityClasses.padding} border-b transition-all duration-200 cursor-pointer overflow-hidden
  {isSelected
    ? 'bg-blue-500/10 border-blue-500/30'
    : 'border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'}"
  class:opacity-100={item.is_read === 0}
  class:opacity-60={item.is_read === 1}
  on:click={handleClick}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  on:keypress={(e) => e.key === "Enter" && handleClick(e)}
  tabindex="0"
  role="button"
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
              this={Icon}
              size={20}
              class={currentStyle.color}
            />
          {/if}
        </div>
      </div>

      <!-- Feed Title + Timestamp + Read Time -->
      <div
        class="flex-1 min-w-0 flex items-center gap-2 text-sm pt-1 flex-wrap"
      >
        <span class="font-bold text-accent truncate">{item.feed_title}</span>
        {#if isCached}
          <OfflineBadge size="sm" showText={false} />
        {/if}
        {#if showDiversityBadge}
          <span
            class="px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-[8px] font-semibold text-cyan-400"
            title="New source - explore diverse content">NEW</span
          >
        {/if}
        <span class="text-zinc-600">•</span>
        <span class="text-orange-400 whitespace-nowrap">{timeAgo}</span>
        {#if readTimeText}
          <span class="text-zinc-600">•</span>
          <span class="text-zinc-500 whitespace-nowrap flex items-center gap-1">
            <Clock size={12} />
            {readTimeText}
          </span>
        {/if}
      </div>
    </div>

    <!-- Article Title (Full Width) -->
    <h3
      class="{densityClasses.titleSize} font-semibold leading-snug transition-colors {densityClasses.spacing} {item.is_read
        ? 'text-zinc-500 font-normal'
        : 'text-white'}"
    >
      {item.title}
    </h3>

    <!-- Actions Bar -->
    <div class="flex items-center justify-between pt-2 mt-auto">
      <div class="flex items-center gap-4">
        <button
          class="p-1.5 -ml-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5 {item.is_read
            ? 'text-emerald-400'
            : 'text-zinc-500 hover:text-white'}"
          on:click={handleRead}
          title={item.is_read ? "Mark as Unread" : "Mark as Read"}
        >
          {#if item.is_read}
            <CheckCircle2 size={18} />
          {:else}
            <div
              class="w-[18px] h-[18px] border-2 border-current rounded-full"
            ></div>
          {/if}
        </button>

        <button
          class="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors flex items-center gap-1.5 {item.is_starred
            ? 'text-orange-400'
            : 'text-zinc-500 hover:text-white'}"
          on:click={handleStar}
          title="Bookmark"
        >
          <Bookmark size={18} class={item.is_starred ? "fill-current" : ""} />
        </button>

        {#if isPlayable}
          <div class="flex items-center gap-2">
            <button
              class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors border border-zinc-700"
              on:click={handlePlay}
              title="Play Episode"
            >
              <PlayCircle size={14} class="fill-current text-accent" />
              <span>Play</span>
            </button>
          </div>
        {/if}

        <button
          class="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-blue-400 transition-colors"
          on:click={handleShare}
          title="Share"
        >
          <Share2 size={18} />
        </button>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          class="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-blue-400 transition-colors"
          on:click|stopPropagation
          title="Open Link"
        >
          <ExternalLink size={18} />
        </a>
      </div>
    </div>
  </div>

  <!-- Right Column: Media (Thumbnail on Desktop) -->
  {#if youtubeVideoId}
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
          src={youtubeThumbnail}
          alt={item.title}
          class="w-full h-full object-cover opacity-100 transition-opacity"
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
  {:else if thumbnailUrl && !imageError}
    <!-- Image: Full width on mobile, Thumbnail on desktop -->
    <div
      class="w-full aspect-video sm:aspect-[2/1] md:w-48 md:h-32 md:aspect-auto md:flex-shrink-0 md:ml-4 rounded-xl overflow-hidden bg-zinc-900 {densityClasses.mediaSpacing} md:mb-0 border border-zinc-800 mt-3 md:mt-0"
    >
      <img
        src={thumbnailUrl}
        alt={item.title}
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
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
</style>
