<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
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
  import { formatDuration } from "$lib/utils/formatDuration";
  import { stripHtml } from "$lib/utils/sanitize";
  import OfflineBadge from "$lib/components/OfflineBadge.svelte";
  import { offlineArticles } from "$lib/stores/offlineArticles";
  import { diversitySettings } from "$lib/stores/diversity";
  import type { ItemWithDiversity } from "$lib/stores/diversity";
  import { createSwipeGesture } from "$lib/composables/useSwipeGesture";

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
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
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
    youtubeThumbnail ||
    (feedType === "podcast"
      ? item.feed_icon_url || item.media_thumbnail
      : isRedditVideo
        ? null
        : item.media_thumbnail);

  $: isPodcast = feedType === "podcast";
  $: durationSeconds = item.media_duration_seconds ?? null;
  $: hasDuration = typeof durationSeconds === "number" && durationSeconds > 0;
  $: progressSeconds = Math.max(0, item.playback_position || 0);
  $: hasProgress = progressSeconds > 5;
  $: progressPercent =
    hasDuration && durationSeconds
      ? Math.min(100, (progressSeconds / durationSeconds) * 100)
      : 0;
  $: remainingSeconds =
    hasDuration && durationSeconds
      ? Math.max(0, durationSeconds - progressSeconds)
      : null;

  // Format Date
  // Format Date
  let dateStr = "";
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
      }).format(date);
    }
  } catch (e) {
    console.error("Error formatting date", item.id, e);
  }

  // Source Styling
  const styles = {
    youtube: {
      color: "text-accent",
      border: "group-hover:border-accent/30",
      glow: "group-hover:shadow-[0_0_20px_-5px_rgba(var(--accent-color-rgb),0.3)]",
      icon: PlayCircle,
    },
    reddit: {
      color: "text-accent",
      border: "group-hover:border-accent/30",
      glow: "group-hover:shadow-[0_0_20px_-5px_rgba(var(--accent-color-rgb),0.3)]",
      icon: Hash,
    },
    podcast: {
      color: "text-accent",
      border: "group-hover:border-accent/30",
      glow: "group-hover:shadow-[0_0_20px_-5px_rgba(var(--accent-color-rgb),0.3)]",
      icon: Radio,
    },
    rss: {
      color: "text-accent",
      border: "group-hover:border-accent/30",
      glow: "group-hover:shadow-[0_0_20px_-5px_rgba(var(--accent-color-rgb),0.3)]",
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
  $: enclosureUrl =
    typeof item.enclosure === "string"
      ? item.enclosure
      : item.enclosure && typeof item.enclosure === "object"
        ? item.enclosure.url
        : null;

  $: fallbackAudioUrl =
    item.url && /\.(mp3|m4a|aac|ogg|opus|wav|flac)(\?|#|$)/i.test(item.url)
      ? item.url
      : null;

  $: isPlayable =
    (feedType === "podcast" &&
      (enclosureUrl || fallbackAudioUrl || item.url)) ||
    Boolean(enclosureUrl || fallbackAudioUrl) ||
    feedType === "youtube" ||
    item.external_id;

  // Swipe Gestures (using composable)
  let articleElement: HTMLElement;
  let touchDiff = 0;
  const SWIPE_THRESHOLD = 75;

  onMount(() => {
    const cleanup = createSwipeGesture({
      element: articleElement,
      swipeThreshold: SWIPE_THRESHOLD,
      onSwipeRight: () => dispatch("toggleRead", { item }),
      onSwipeLeft: () => dispatch("toggleStar", { item }),
      onSwipeProgress: (progress, direction) => {
        touchDiff =
          direction === "right"
            ? progress * SWIPE_THRESHOLD
            : -progress * SWIPE_THRESHOLD;
      },
      onSwipeEnd: () => {
        touchDiff = 0;
      },
    });

    return cleanup;
  });
</script>

<article
  class="group relative flex flex-col w-full overflow-hidden rounded-2xl bg-surface border border-stroke transition-all duration-300 hover:bg-raised hover:border-zinc-700/50 cursor-pointer shadow-sm hover:shadow-md"
  bind:this={articleElement}
  style="transform: translateX({touchDiff}px); transition: {touchDiff !== 0
    ? 'none'
    : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'}"
  on:click={handleOpen}
  on:keypress={(e) => e.key === "Enter" && handleOpen()}
  tabindex="0"
  role="button"
  aria-label="Open article: {item.title || 'Untitled'}"
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
  <div class="relative z-10 bg-zinc-900 h-full flex flex-col">
    {#if thumbnailUrl}
      <div class="relative w-full aspect-video overflow-hidden bg-zinc-950/20">
        <img
          src={thumbnailUrl}
          alt={item.title}
          class="w-full h-full object-cover transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
          loading="lazy"
        />

        <!-- Soft Gradient Overlay -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-40"
        ></div>

        <!-- Source Badge -->
        <div
          class="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-zinc-950/40 backdrop-blur-md border border-white/10 flex items-center gap-2 shadow-sm"
        >
          <svelte:component this={Icon} size={14} class={currentStyle.color} />
          <span class="text-[11px] font-bold tracking-tight text-white/90"
            >{item.feed_title}</span
          >
          {#if isCached}
            <OfflineBadge size="sm" showText={false} />
          {/if}
          {#if showDiversityBadge}
            <div
              class="px-1.5 py-0.5 rounded-full bg-accent/20 border border-accent/30 flex items-center gap-1"
              title="New source - explore diverse content"
            >
              <span class="text-[9px] font-bold text-accent">NEW</span>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- No Image: Header strip -->
      <div class="px-5 pt-5 pb-2 flex items-center gap-2">
        <div
          class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-raised/50 border border-stroke shadow-sm"
        >
          <svelte:component this={Icon} size={14} class={currentStyle.color} />
          <span class="text-[11px] font-bold tracking-tight text-muted"
            >{item.feed_title}</span
          >
          {#if isCached}
            <OfflineBadge size="sm" showText={false} />
          {/if}
          {#if showDiversityBadge}
            <div
              class="px-1.5 py-0.5 rounded-full bg-accent/20 border border-accent/20 flex items-center gap-1"
              title="New source - explore diverse content"
            >
              <span class="text-[9px] font-bold text-accent">NEW</span>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Content Body -->
    <div class="flex flex-col flex-1 p-3 md:p-5 pt-2 md:pt-3">
      <!-- Meta -->
      <div
        class="flex items-center justify-between mb-3 text-[13px] font-medium text-muted"
      >
        <span>{dateStr}</span>
        {#if item.is_read}
          <span class="text-zinc-600/60 flex items-center gap-1.5"
            ><CheckCircle2 size={13} /> Read</span
          >
        {/if}
      </div>

      <!-- Title -->
      <h3
        class="text-[17px] font-bold text-accent leading-[1.3] line-clamp-2 md:line-clamp-3 mb-3 group-hover:text-accent/90 transition-colors {item.is_read
          ? 'text-zinc-500/80'
          : ''}"
      >
        {item.title}
      </h3>

      {#if isPodcast}
        <div class="mb-3 flex flex-col gap-2">
          <div
            class="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400"
          >
            <span
              class="inline-flex items-center gap-1 rounded-full bg-zinc-800/80 border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase text-zinc-200"
            >
              <Radio size={12} class="text-accent" />
              Podcast
            </span>
            {#if hasDuration}
              <span class="text-zinc-500">
                {hasProgress
                  ? `${formatDuration(remainingSeconds)} left`
                  : formatDuration(durationSeconds)}
              </span>
            {:else if hasProgress}
              <span class="text-zinc-500">
                Resume at {formatDuration(progressSeconds)}
              </span>
            {/if}
          </div>
          {#if hasDuration}
            <div class="h-1.5 w-full rounded-full bg-white/5">
              <div
                class="h-full rounded-full bg-accent/80 transition-all"
                style="width: {progressPercent}%"
              ></div>
            </div>
          {/if}
        </div>
      {/if}

      {#if item.summary}
        <p
          class="text-[14px] text-zinc-400/90 line-clamp-2 leading-relaxed mb-6 hidden sm:block {item.is_read
            ? 'text-zinc-600/70'
            : ''}"
        >
          {stripHtml(item.summary)}
        </p>
      {/if}

      <!-- Spacer to push actions to bottom -->
      <div class="mt-auto"></div>

      <!-- Actions Bar -->
      <div
        class="flex items-center justify-between pt-4 mt-2 border-t border-stroke opacity-60 md:opacity-0 md:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-400 ease-out"
      >
        <!-- Read Later / Bookmark Toggle -->
        <button
          class="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-raised transition-colors {item.is_read
            ? 'text-accent'
            : 'text-muted hover:text-white'}"
          title={item.is_read ? "Mark as Unread" : "Mark as Read"}
          aria-label={item.is_read ? "Mark as Unread" : "Mark as Read"}
          on:click={handleRead}
        >
          {#if item.is_read}
            <CheckCircle2 size={20} />
          {:else}
            <div class="w-5 h-5 border-2 border-current rounded-full"></div>
          {/if}
        </button>

        <div class="flex items-center gap-1">
          {#if isPlayable}
            <button
              class="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-raised text-muted hover:text-accent transition-colors"
              title={isPodcast
                ? hasProgress
                  ? "Resume Episode"
                  : "Play Episode"
                : "Play"}
              aria-label={isPodcast
                ? hasProgress
                  ? "Resume Episode"
                  : "Play Episode"
                : "Play"}
              on:click={handlePlay}
            >
              <PlayCircle size={20} />
            </button>
          {/if}

          <button
            class="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-raised text-muted hover:text-[#FF9500] transition-colors"
            title="Bookmark"
            aria-label={item.is_starred ? "Remove Bookmark" : "Add Bookmark"}
            on:click={handleStar}
          >
            <Bookmark
              size={20}
              class={item.is_starred ? "fill-[#FF9500] text-[#FF9500]" : ""}
            />
          </button>

          <button
            class="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-raised text-muted hover:text-blue-500 transition-colors"
            title="Share"
            aria-label="Share Article"
            on:click={handleShare}
          >
            <Share2 size={20} />
          </button>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            class="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-raised text-muted hover:text-blue-500 transition-colors"
            title="Open Link"
            aria-label="Open Article in New Tab"
            on:click|stopPropagation
          >
            <ExternalLink size={20} />
          </a>
        </div>
      </div>
    </div>
  </div>
  <!-- Close the wrapper div -->
</article>
