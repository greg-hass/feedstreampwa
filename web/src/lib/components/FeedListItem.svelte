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
    Clock,
  } from "lucide-svelte";

  export let item: Item;
  export let feedType: "rss" | "youtube" | "reddit" | "podcast" = "rss";

  const dispatch = createEventDispatcher();

  // Extract YouTube video ID from external_id or URL
  $: youtubeVideoId = (() => {
    if (item.external_id) return item.external_id;
    if (item.url) {
      const match = item.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
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
  const date = new Date(item.published_at || item.created_at);
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  // Time ago
  const timeAgo = getTimeAgo(date);

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
      icon: Hash,
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

  // Check if item is playable (podcast or video)
  $: isPlayable =
    feedType === "podcast" ||
    feedType === "youtube" ||
    item.enclosure ||
    item.external_id;

  // Track whether YouTube video should be loaded/played
  let playYouTubeVideo = false;

  function toggleYouTubePlay(e: MouseEvent) {
    e.stopPropagation();
    playYouTubeVideo = !playYouTubeVideo;
  }
</script>

<article
  class="group flex flex-col sm:flex-row gap-3 sm:gap-4 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
  on:click={handleOpen}
  on:keypress={(e) => e.key === "Enter" && handleOpen()}
  tabindex="0"
  role="button"
>
  <!-- Desktop: Thumbnail (Left) -->
  {#if thumbnailUrl}
    <div class="hidden sm:flex flex-shrink-0">
      <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-white/5">
        <img
          src={thumbnailUrl}
          alt={item.title}
          class="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    </div>
  {:else}
    <div class="hidden sm:flex flex-shrink-0">
      <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-white/5 flex items-center justify-center">
        <svelte:component this={Icon} size={28} class={currentStyle.color} />
      </div>
    </div>
  {/if}

  <!-- Content (Middle) -->
  <div class="flex-1 min-w-0 flex flex-col justify-between py-1">
    <!-- Top Row: Source + Date -->
    <div class="flex items-center gap-2 mb-1.5 text-xs text-white/50">
      <svelte:component this={Icon} size={12} class={currentStyle.color} />
      <span class="font-medium">{item.feed_title}</span>
      <span class="text-white/30">•</span>
      <div class="flex items-center gap-1">
        <Clock size={10} />
        <span>{timeAgo}</span>
      </div>
      {#if item.is_read}
        <span class="text-white/30 flex items-center gap-1">
          <CheckCircle2 size={10} /> Read
        </span>
      {/if}
    </div>

    <!-- Title -->
    <h3
      class="text-sm sm:text-base font-medium text-gray-100 leading-snug line-clamp-2 mb-1 group-hover:text-white transition-colors {item.is_read
        ? 'text-white/50'
        : ''}"
    >
      {item.title}
    </h3>

    <!-- Summary (Desktop) -->
    {#if item.summary}
      <p
        class="text-xs sm:text-sm text-gray-500 line-clamp-1 leading-relaxed hidden sm:block {item.is_read
          ? 'text-white/30'
          : ''}"
      >
        {@html item.summary.replace(/<[^>]*>?/gm, "")}
      </p>
    {/if}

    <!-- Mobile: Thumbnail/Video below title -->
    <div class="sm:hidden mt-2">
      {#if youtubeVideoId}
        <!-- YouTube inline player on mobile -->
        <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          {#if playYouTubeVideo}
            <iframe
              src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0`}
              class="w-full h-full"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              on:click|stopPropagation
            ></iframe>
          {:else}
            <img
              src={youtubeThumbnail}
              alt={item.title}
              class="w-full h-full object-cover"
              loading="lazy"
            />
            <button
              on:click={toggleYouTubePlay}
              class="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              aria-label="Play video"
            >
              <div class="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                <PlayCircle size={28} class="text-black fill-black" />
              </div>
            </button>
          {/if}
        </div>
      {:else if thumbnailUrl}
        <!-- Regular image thumbnail on mobile -->
        <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-white/5">
          <img
            src={thumbnailUrl}
            alt={item.title}
            class="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      {/if}
    </div>
  </div>

  <!-- Actions (Right) -->
  <div class="flex-shrink-0 flex items-center gap-1 py-1">
    <!-- Mark as Read -->
    <button
      class="p-2 rounded-lg hover:bg-white/10 transition-colors {item.is_read
        ? 'text-green-400'
        : 'text-white/40 hover:text-white'}"
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

    {#if isPlayable}
      <button
        class="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-accent transition-colors"
        title="Play"
        on:click={handlePlay}
      >
        <PlayCircle size={18} />
      </button>
    {/if}

    <button
      class="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-orange-400 transition-colors"
      title="Bookmark"
      on:click={handleStar}
    >
      <Bookmark
        size={18}
        class={item.is_starred ? "fill-orange-400 text-orange-400" : ""}
      />
    </button>

    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      class="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-blue-400 transition-colors"
      title="Open Link"
      on:click|stopPropagation
    >
      <ExternalLink size={18} />
    </a>
  </div>
</article>

<style>
  article {
    scroll-margin-top: 80px;
  }
</style>
