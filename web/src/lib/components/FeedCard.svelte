<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { Item } from "$lib/types";
  import {
    Bookmark,
    ExternalLink,
    PlayCircle,
    Radio,
    Rss,
    Hash,
    CheckCircle2,
    Share2,
  } from "lucide-svelte";
  import OfflineBadge from "$lib/components/OfflineBadge.svelte";
  import { offlineArticles } from "$lib/stores/offlineArticles";
  import { diversitySettings } from "$lib/stores/diversity";
  import type { ItemWithDiversity } from "$lib/stores/diversity";

  export let item: Item;
  export let feedType: "rss" | "youtube" | "reddit" | "podcast" = "rss";

  const dispatch = createEventDispatcher();

  // Cast to diversity-aware item
  $: diversityItem = item as ItemWithDiversity;
  $: showDiversityBadge =
    $diversitySettings.enabled && diversityItem._isDiverseSource;

  // Check if this article is cached for offline
  $: isCached = $offlineArticles.has(item.id);

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

  // Check if Reddit post contains video (Reddit video posts have media_thumbnail but can't be played)
  $: isRedditVideo =
    feedType === "reddit" &&
    item.url &&
    (item.url.includes("v.redd.it") ||
      (item.url.includes("/comments/") && item.media_thumbnail));

  // Use YouTube thumbnail if available, otherwise use media_thumbnail (but skip Reddit videos)
  $: thumbnailUrl =
    youtubeThumbnail || (isRedditVideo ? null : item.media_thumbnail);

  // Format Date
  const date = new Date(item.published || item.created_at);
  const now = new Date();
  const isCurrentYear = date.getFullYear() === now.getFullYear();

  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: isCurrentYear ? undefined : "numeric",
  }).format(date);

  // Source Styling
  const styles = {
    youtube: {
      color: "text-youtube",
      border: "group-hover:border-youtube/30",
      glow: "group-hover:shadow-[0_0_20px_-5px_rgba(255,0,0,0.3)]",
      icon: PlayCircle,
    },
    reddit: {
      color: "text-reddit",
      border: "group-hover:border-reddit/30",
      glow: "group-hover:shadow-[0_0_20px_-5px_rgba(255,69,0,0.3)]",
      icon: Hash,
    },
    podcast: {
      color: "text-podcast",
      border: "group-hover:border-podcast/30",
      glow: "group-hover:shadow-[0_0_20px_-5px_rgba(139,92,246,0.3)]",
      icon: Radio,
    },
    rss: {
      color: "text-emerald-400",
      border: "group-hover:border-emerald-500/30",
      glow: "group-hover:shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]",
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
    } catch (e) {
      console.error("Failed to share:", e);
    }
  }

  // Check if item is playable (podcast or video)
  $: isPlayable =
    feedType === "podcast" ||
    feedType === "youtube" ||
    item.enclosure ||
    item.external_id;

  // Swipe Gestures
  let touchStartX = 0;
  let touchDiff = 0;
  let isSwiping = false;
  const SWIPE_THRESHOLD = 75;

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    isSwiping = true;
    touchDiff = 0;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isSwiping) return;
    touchDiff = e.touches[0].clientX - touchStartX;
  }

  function handleTouchEnd() {
    if (!isSwiping) return;

    if (Math.abs(touchDiff) > SWIPE_THRESHOLD) {
      if (touchDiff > 0) {
        dispatch("toggleRead", { item });
      } else {
        dispatch("toggleStar", { item });
      }
    }

    isSwiping = false;
    touchDiff = 0;
  }
</script>

<article
  class="group relative flex flex-col w-full overflow-hidden rounded-xl bg-surface border border-white/5 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#16161a] hover:border-white/10 cursor-pointer"
  style="transform: translateX({isSwiping
    ? touchDiff
    : 0}px); transition: {isSwiping ? 'none' : 'transform 0.3s'}"
  on:click={handleOpen}
  on:keypress={(e) => e.key === "Enter" && handleOpen()}
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
  tabindex="0"
  role="button"
>
  <!-- Background Indicators for Swipe -->
  {#if Math.abs(touchDiff) > 20}
    <div
      class="absolute inset-y-0 w-full flex items-center px-6 z-0 transition-opacity duration-200"
      style="
        opacity: {Math.min(Math.abs(touchDiff) / SWIPE_THRESHOLD, 1)};
        background: {touchDiff > 0 ? '#10B981' : '#FF9500'};
        justify-content: {touchDiff > 0 ? 'flex-start' : 'flex-end'};
        left: {touchDiff > 0 ? '-100%' : '100%'};
        transform: translateX({touchDiff > 0 ? '100%' : '-100%'});
      "
    >
      {#if touchDiff > 0}
        <CheckCircle2 class="text-white" size={32} />
      {:else}
        <Bookmark class="text-white" size={32} fill="currentColor" />
      {/if}
    </div>
  {/if}

  <!-- Image Preview (Conditional) -->
  <div class="relative z-10 bg-surface h-full flex flex-col">
    {#if thumbnailUrl}
      <div class="relative w-full aspect-video overflow-hidden">
        <img
          src={thumbnailUrl}
          alt={item.title}
          class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        <!-- Gradient Overlay -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"
        ></div>

        <!-- Source Badge -->
        <div
          class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-1.5 shadow-lg"
        >
          <svelte:component this={Icon} size={12} class={currentStyle.color} />
          <span
            class="text-[10px] font-medium tracking-wide text-white/90 uppercase"
            >{item.feed_title}</span
          >
          {#if isCached}
            <OfflineBadge size="sm" showText={false} />
          {/if}
          {#if showDiversityBadge}
            <div
              class="px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-1"
              title="New source - explore diverse content"
            >
              <span class="text-[8px] font-semibold text-cyan-400">NEW</span>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- No Image: Header strip -->
      <div class="px-3 md:px-5 pt-3 md:pt-5 pb-2 flex items-center gap-2">
        <div
          class="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/5"
        >
          <svelte:component this={Icon} size={12} class={currentStyle.color} />
          <span
            class="text-[10px] font-medium tracking-wide text-white/60 uppercase"
            >{item.feed_title}</span
          >
          {#if isCached}
            <OfflineBadge size="sm" showText={false} />
          {/if}
          {#if showDiversityBadge}
            <div
              class="px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-1"
              title="New source - explore diverse content"
            >
              <span class="text-[8px] font-semibold text-cyan-400">NEW</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Content Body -->
    <div class="flex flex-col flex-1 p-3 md:p-5 pt-2 md:pt-3">
      <!-- Meta -->
      <div
        class="flex items-center justify-between mb-2 text-xs text-indigo-400"
      >
        <span>{dateStr}</span>
        {#if item.is_read}
          <span class="text-white/20 flex items-center gap-1"
            ><CheckCircle2 size={12} /> Read</span
          >
        {/if}
      </div>

      <!-- Title -->
      <h3
        class="text-base font-semibold text-emerald-400 leading-tight line-clamp-2 md:line-clamp-3 mb-2 group-hover:text-emerald-300 transition-colors {item.is_read
          ? 'text-white/50'
          : ''}"
      >
        {item.title}
      </h3>

      <!-- Summary (Optional / Desktop only mostly) -->
      {#if item.summary}
        <p
          class="text-sm text-gray-400 line-clamp-2 leading-relaxed mb-4 hidden sm:block {item.is_read
            ? 'text-white/30'
            : ''}"
        >
          {@html item.summary.replace(/<[^>]*>?/gm, "")}
        </p>
      {/if}

      <!-- Spacer to push actions to bottom -->
      <div class="mt-auto"></div>

      <!-- Actions Bar -->
      <div
        class="flex items-center justify-between pt-4 mt-2 border-t border-white/5 opacity-80 md:opacity-0 md:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
      >
        <!-- Read Later / Bookmark Toggle -->
        <button
          class="p-2 rounded-full hover:bg-white/10 transition-colors {item.is_read
            ? 'text-green-400'
            : 'text-white/60 hover:text-white'}"
          title={item.is_read ? "Mark as Unread" : "Mark as Read"}
          on:click={handleRead}
        >
          {#if item.is_read}
            <CheckCircle2 size={18} />
          {:else}
            <div
              class="w-[18px] h-[18px] border-2 border-current rounded-full"
            ></div>
          {/if}
        </button>

        <div class="flex items-center gap-1">
          {#if isPlayable}
            <button
              class="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-accent transition-colors"
              title="Play"
              on:click={handlePlay}
            >
              <PlayCircle size={18} />
            </button>
          {/if}

          <button
            class="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-[#FF9500] transition-colors"
            title="Bookmark"
            on:click={handleStar}
          >
            <Bookmark
              size={18}
              class={item.is_starred ? "fill-[#FF9500] text-[#FF9500]" : ""}
            />
          </button>

          <button
            class="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-blue-400 transition-colors"
            title="Share"
            on:click={handleShare}
          >
            <Share2 size={18} />
          </button>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            class="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-blue-400 transition-colors"
            title="Open Link"
            on:click|stopPropagation
          >
            <ExternalLink size={18} />
          </a>
        </div>
      </div>
    </div>
  </div>
  <!-- Close the wrapper div -->
</article>
