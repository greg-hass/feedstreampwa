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

  function toggleYouTubePlay(e: Event) {
    e.stopPropagation();
    playYouTubeVideo = !playYouTubeVideo;
  }
</script>

<article
  class="group flex flex-row gap-3 sm:gap-4 px-4 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
  on:click={handleOpen}
  on:keypress={(e) => e.key === "Enter" && handleOpen()}
  tabindex="0"
  role="button"
>
  <!-- Left: Icon (Avatar style) -->
  <div class="flex-shrink-0 pt-1">
    <div
      class="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-white/10 transition-colors"
    >
      {#if item.feed_icon_url}
         <img src={item.feed_icon_url} alt="" class="w-6 h-6 sm:w-7 sm:h-7 object-contain opacity-80" />
      {:else}
         <svelte:component this={Icon} size={20} class={currentStyle.color} />
      {/if}
    </div>
  </div>

  <!-- Right: Main Content -->
  <div class="flex-1 min-w-0 flex flex-col gap-2">
    <!-- Header: Meta -->
    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center gap-2 overflow-hidden">
        <span class="font-bold text-gray-200 truncate">{item.feed_title}</span>
        <span class="text-white/30">•</span>
        <span class="text-white/40 whitespace-nowrap">{timeAgo}</span>
      </div>
      {#if item.is_read}
        <div class="flex-shrink-0" title="Read">
            <CheckCircle2 size={14} class="text-emerald-500/50" />
        </div>
      {/if}
    </div>

    <!-- Title -->
    <h3
      class="text-base sm:text-lg font-semibold leading-snug transition-colors {item.is_read
        ? 'text-gray-400 font-normal'
        : 'text-white'}"
    >
      {item.title}
    </h3>

    <!-- Media (Image or Video) - Now Below Title -->
    {#if youtubeVideoId}
       <div class="w-full aspect-video rounded-xl overflow-hidden bg-black mt-1 mb-1 border border-white/10" on:click|stopPropagation role="none">
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
                on:keypress={(e) => e.key === 'Enter' && toggleYouTubePlay(e)}
            >
              <img
                src={youtubeThumbnail}
                alt={item.title}
                class="w-full h-full object-cover opacity-100 transition-opacity"
                loading="lazy"
              />
              <div class="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/10 transition-colors">
                <div class="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl scale-100 group-hover/video:scale-110 transition-transform">
                   <PlayCircle size={32} class="text-white fill-white/20" />
                </div>
              </div>
            </div>
          {/if}
       </div>
    {:else if thumbnailUrl}
       <div class="w-full aspect-video sm:aspect-[2/1] rounded-xl overflow-hidden bg-white/5 mt-1 mb-1 border border-white/5">
          <img
            src={thumbnailUrl}
            alt={item.title}
            class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            loading="lazy"
          />
       </div>
    {/if}

    <!-- Summary -->
    {#if item.summary}
      <p
        class="text-sm text-gray-400 line-clamp-3 leading-relaxed {item.is_read
          ? 'text-gray-500'
          : ''}"
      >
        {@html item.summary.replace(/<[^>]*>?/gm, "")}
      </p>
    {/if}

    <!-- Actions Bar -->
    <div class="flex items-center justify-between pt-2 mt-1">
        <div class="flex items-center gap-4">
             <button
                class="p-1.5 -ml-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 {item.is_read ? 'text-emerald-400' : 'text-white/40 hover:text-white'}"
                on:click={handleRead}
                title={item.is_read ? "Mark as Unread" : "Mark as Read"}
             >
                {#if item.is_read}
                  <CheckCircle2 size={18} />
                {:else}
                  <div class="w-[18px] h-[18px] border-2 border-current rounded-full"></div>
                {/if}
             </button>

             <button
                class="p-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 {item.is_starred ? 'text-orange-400' : 'text-white/40 hover:text-white'}"
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
        </div>
        
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
