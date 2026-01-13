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
    iconSize:
      density === "compact"
        ? "w-8 h-8"
        : density === "spacious"
          ? "w-14 h-14"
          : "w-10 h-10 sm:w-12 sm:h-12",
    iconInnerSize:
      density === "compact"
        ? "w-4 h-4"
        : density === "spacious"
          ? "w-8 h-8"
          : "w-6 h-6 sm:w-7 sm:h-7",
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

  // YouTube thumbnail URL
  $: youtubeThumbnail = youtubeVideoId
    ? `https://img.youtube.com/vi/${youtubeVideoId}/mqdefault.jpg`
    : null;

  // Use YouTube thumbnail if available, otherwise use media_thumbnail
  $: thumbnailUrl = youtubeThumbnail || item.media_thumbnail;

  // Format Date
  let dateStr = "";
  let timeAgo = "";

  try {
    const date = new Date(item.published || item.created_at);
    // Check if date is valid
    if (!isNaN(date.getTime())) {
      const now = new Date();
      const isCurrentYear = date.getFullYear() === now.getFullYear();

      dateStr = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: isCurrentYear ? undefined : "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);

      timeAgo = getTimeAgo(date);
    }
  } catch (e) {
    console.error("Error formatting date for item", item.id, e);
  }

  function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return dateStr;
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
      color: "text-emerald-400",
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

  function handlePlay(e: MouseEvent) {
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
  $: isPlayable =
    feedType === "podcast" ||
    feedType === "youtube" ||
    item.enclosure ||
    item.external_id;

  // Track whether YouTube video should be loaded/played
  let playYouTubeVideo = false;

  function toggleYouTubePlay(e: Event) {
    e.stopPropagation();
    playYouTubeVideo = !playYouTubeVideo;
  }

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
</script>

<article
  class="group relative flex flex-col {densityClasses.padding} border-b transition-all duration-200 cursor-pointer overflow-hidden
  {isSelected
    ? 'bg-blue-500/10 border-blue-500/30'
    : 'border-white/5 hover:bg-white/[0.02] hover:border-white/10'}"
  class:opacity-100={item.is_read === 0}
  class:opacity-60={item.is_read === 1}
  on:click={handleClick}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
  on:keypress={(e) => e.key === "Enter" && handleClick(e)}
  tabindex="0"
  role="button"
>
  <!-- Header: Feed Icon + Feed Title + Timestamp -->
  <div class="flex items-start gap-3 {densityClasses.headerSpacing}">
    <!-- Feed Icon -->
    <div class="flex-shrink-0">
      <div
        class="{densityClasses.iconSize} rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-white/10 transition-colors"
      >
        {#if item.feed_icon_url}
          <img
            src={item.feed_icon_url}
            alt=""
            class="{densityClasses.iconInnerSize} object-contain opacity-80"
          />
        {:else}
          <svelte:component this={Icon} size={20} class={currentStyle.color} />
        {/if}
      </div>
    </div>

    <!-- Feed Title + Timestamp + Read Time -->
    <div class="flex-1 min-w-0 flex items-center gap-2 text-sm pt-1 flex-wrap">
      <span class="font-bold text-indigo-400 truncate">{item.feed_title}</span>
      {#if isCached}
        <OfflineBadge size="sm" showText={false} />
      {/if}
      {#if showDiversityBadge}
        <span
          class="px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-[8px] font-semibold text-cyan-400"
          title="New source - explore diverse content">NEW</span
        >
      {/if}
      <span class="text-white/30">•</span>
      <span class="text-orange-400 whitespace-nowrap">{timeAgo}</span>
      {#if readTimeText}
        <span class="text-white/30">•</span>
        <span class="text-white/40 whitespace-nowrap flex items-center gap-1">
          <Clock size={12} />
          {readTimeText}
        </span>
      {/if}
    </div>
  </div>

  <!-- Article Title (Full Width) -->
  <h3
    class="{densityClasses.titleSize} font-semibold leading-snug transition-colors {densityClasses.spacing} {item.is_read
      ? 'text-gray-400 font-normal'
      : 'text-white'}"
  >
    {item.title}
  </h3>

  <!-- Media (Image or Video) - Full Width Below Title -->
  {#if youtubeVideoId}
    <div
      class="w-full aspect-video rounded-xl overflow-hidden bg-black {densityClasses.mediaSpacing} border border-white/10"
      on:click|stopPropagation
      role="none"
    >
      {#if playYouTubeVideo}
        <iframe
          src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0&vq=hd1080`}
          class="w-full h-full"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
          title={item.title}
        ></iframe>
      {:else}
        <div
          class="relative w-full h-full group/video cursor-pointer"
          on:click={toggleYouTubePlay}
          role="button"
          tabindex="0"
          on:keypress={(e) => e.key === "Enter" && toggleYouTubePlay(e)}
        >
          <img
            src={youtubeThumbnail}
            alt={item.title}
            class="w-full h-full object-cover opacity-100 transition-opacity"
            loading="lazy"
          />
          <div
            class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/10 transition-colors"
          >
            <div
              class="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl scale-100 group-hover/video:scale-110 transition-transform"
            >
              <PlayCircle size={32} class="text-white fill-white/20" />
            </div>
          </div>
        </div>
      {/if}
    </div>
  {:else if thumbnailUrl}
    <div
      class="w-full aspect-video sm:aspect-[2/1] rounded-xl overflow-hidden bg-white/5 {densityClasses.mediaSpacing} border border-white/5"
    >
      <img
        src={thumbnailUrl}
        alt={item.title}
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        loading="lazy"
      />
    </div>
  {/if}

  <!-- Actions Bar -->
  <div
    class="flex items-center justify-between pt-2 mt-1 border-t border-white/5"
  >
    <div class="flex items-center gap-4">
      <button
        class="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 {item.is_read
          ? 'text-emerald-400'
          : 'text-white/40 hover:text-white'}"
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
        class="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 {item.is_starred
          ? 'text-orange-400'
          : 'text-white/40 hover:text-white'}"
        on:click={handleStar}
        title="Bookmark"
      >
        <Bookmark size={18} class={item.is_starred ? "fill-current" : ""} />
      </button>

      {#if isPlayable}
        <button
          class="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-accent"
          on:click={handlePlay}
          title="Play"
        >
          <PlayCircle size={18} />
        </button>
      {/if}

      <button
        class="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
        on:click={handleShare}
        title="Share"
      >
        <Share2 size={18} />
      </button>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        class="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
        on:click|stopPropagation
        title="Open Link"
      >
        <ExternalLink size={18} />
      </a>
    </div>
  </div>
</article>

<style>
  article {
    scroll-margin-top: 80px;
  }
</style>
