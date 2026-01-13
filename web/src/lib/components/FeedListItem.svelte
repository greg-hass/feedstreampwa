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
  import RedditIcon from "$lib/components/icons/RedditIcon.svelte";

  export let item: Item;
  export let feedType: "rss" | "youtube" | "reddit" | "podcast" = "rss";

  const dispatch = createEventDispatcher();

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
  class="group flex flex-col gap-3 sm:gap-4 px-4 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
  on:click={handleOpen}
  on:keypress={(e) => e.key === "Enter" && handleOpen()}
  tabindex="0"
  role="button"
>
  <!-- Hero Image (Desktop & Mobile) -->
  {#if thumbnailUrl && !youtubeVideoId}
    <div class="w-full aspect-video sm:aspect-[21/9] rounded-xl overflow-hidden bg-white/5 mb-2">
      <img
        src={thumbnailUrl}
        alt={item.title}
        class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
      />
    </div>
  {:else if youtubeVideoId}
     <!-- YouTube Inline Player -->
     <div class="w-full aspect-video rounded-xl overflow-hidden bg-black mb-2">
        {#if playYouTubeVideo}
          <iframe
            src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0&vq=hd1080`}
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
            class="absolute inset-0 flex items-center justify-center bg-black/10 hover:bg-black/20 transition-colors"
            aria-label="Play video"
          >
            <div
              class="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform"
            >
              <PlayCircle size={40} class="text-white fill-white/20" />
            </div>
          </button>
        {/if}
     </div>
  {/if}

  <div class="flex flex-row gap-4">
    <!-- Icon Placeholder if no image (Optional, or just keep it simple) -->
    {#if !thumbnailUrl && !youtubeVideoId}
      <div class="hidden sm:flex flex-shrink-0">
        <div
          class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center"
        >
          <svelte:component this={Icon} size={20} class={currentStyle.color} />
        </div>
      </div>
    {/if}

    <!-- Content (Middle) -->
    <div class="flex-1 min-w-0 flex flex-col justify-between py-1">
    <!-- Top Row: Source + Date -->
    <!-- Top Row: Source + Date -->
    <div class="flex items-center gap-2 mb-1.5 text-sm">
      <div class="flex items-center gap-2 text-emerald-400">
        <svelte:component this={Icon} size={14} class={currentStyle.color} />
        <span class="font-medium">{item.feed_title}</span>
      </div>
      <span class="text-white/30">•</span>
      <div class="flex items-center gap-1 text-purple-400">
        <Clock size={12} />
        <span>{timeAgo}</span>
      </div>
      {#if item.is_read}
        <span class="text-white/30 flex items-center gap-1 text-xs">
          <CheckCircle2 size={12} /> Read
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
  </div>
</article>

<style>
  article {
    scroll-margin-top: 80px;
  }
</style>
