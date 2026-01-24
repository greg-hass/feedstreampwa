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
    MoreHorizontal
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
  export let timeAgo: string = "";

  const dispatch = createEventDispatcher();

  // Extract YouTube video ID
  function extractYouTubeId(externalId: string | null | undefined, url: string | null | undefined): string | null {
    if (externalId) return externalId;
    if (url) {
      const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }
    return null;
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

  // Simplified logic: Compact = List (no image), Comfortable = Right Image, Spacious = Top Image (Card)
  $: showImage = density !== "compact" && (itemMeta.thumbnailUrl || itemMeta.youtubeVideoId) && !imageError;
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
  
  $: if (item.id) imageError = false;
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-to-interactive-role -->
<article
  class="group relative flex w-full transition-colors cursor-pointer overflow-hidden
  {isCardLayout ? 'flex-col p-0 bg-surface border border-stroke rounded-2xl mb-4' : 'flex-row py-4 px-4 border-b border-stroke/50 last:border-0 items-start gap-4'}
  {item.is_read ? 'opacity-60' : 'opacity-100'}"
  on:click={handleClick}
  on:keypress={(e) => e.key === "Enter" && handleClick(e)}
  tabindex="0"
  role="button"
>
  
  <!-- Image Section -->
  {#if showImage}
    <div 
      class="{isCardLayout ? 'w-full aspect-video' : 'w-24 h-24 md:w-32 md:h-24 flex-shrink-0 order-last'} bg-zinc-900 overflow-hidden relative"
      class:rounded-xl={!isCardLayout}
    >
      {#if itemMeta.youtubeVideoId}
        <img
          src={itemMeta.youtubeThumbnail}
          alt=""
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          on:error={handleYouTubeThumbnailError}
        />
        <div class="absolute inset-0 flex items-center justify-center bg-black/20">
          <PlayCircle size={isCardLayout ? 48 : 24} class="text-white drop-shadow-lg opacity-90" fill="rgba(0,0,0,0.5)" />
        </div>
      {:else}
        <img
          src={itemMeta.thumbnailUrl}
          alt=""
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          on:error={handleImageError}
        />
      {/if}
    </div>
  {/if}

  <!-- Content Section -->
  <div class="flex-1 min-w-0 flex flex-col {isCardLayout ? 'p-4' : ''}">
    
    <!-- Meta Header -->
    <div class="flex items-center gap-2 text-xs mb-1.5">
      {#if item.feed_icon_url}
        <img src={item.feed_icon_url} alt="" class="w-4 h-4 rounded-full" />
      {:else}
        <svelte:component this={currentStyle.icon} size={14} class={currentStyle.color} />
      {/if}
      
      <span class="font-medium text-zinc-300 truncate max-w-[120px]">{item.feed_title}</span>
      <span class="text-zinc-600">•</span>
      <span class="text-zinc-500">{timeAgo}</span>
      
      {#if item.is_starred}
         <Bookmark size={12} class="text-orange-400 fill-orange-400 ml-auto" />
      {/if}
    </div>

    <!-- Title -->
    <h3 class="{isCardLayout ? 'text-xl' : 'text-[17px]'} font-bold leading-tight text-balance text-white mb-2 tracking-tight">
      {item.title}
    </h3>
    
    <!-- Summary / Snippet (Card only or if no image) -->
    {#if (isCardLayout || !showImage) && item.summary && density !== 'compact'}
       <p class="text-sm text-zinc-400 line-clamp-2 mb-3 leading-relaxed">
         {item.summary.replace(/<[^>]*>?/gm, "")}
       </p>
    {/if}

    <!-- Footer Actions -->
    <div class="mt-auto flex items-center justify-between pt-1">
       <div class="flex items-center gap-4 text-zinc-500">
         {#if itemMeta.readTimeText}
           <span class="text-xs flex items-center gap-1 font-medium">
             <Clock size={12} /> {itemMeta.readTimeText}
           </span>
         {/if}
       </div>
       
       <!-- Quick Actions (Hover only on desktop, or visible if spacious) -->
       <div class="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
         <button 
           class="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
           on:click={handleStar}
           title="Bookmark"
         >
           <Bookmark size={16} class={item.is_starred ? "fill-orange-400 text-orange-400" : ""} />
         </button>
         
         <button 
           class="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
           on:click={handleRead}
           title="Mark read"
         >
           {#if item.is_read}
             <CheckCircle2 size={16} class="text-emerald-500" />
           {:else}
             <div class="w-4 h-4 rounded-full border-2 border-zinc-500"></div>
           {/if}
         </button>
       </div>
    </div>
  </div>

</article>

<style>
  /* No special styles needed, utility first */
</style>
