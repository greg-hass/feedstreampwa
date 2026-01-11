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
  } from "lucide-svelte";

  export let item: Item;
  export let feedType: "rss" | "youtube" | "reddit" | "podcast" = "rss";

  const dispatch = createEventDispatcher();

  // Format Date
  const date = new Date(item.published_at || item.created_at);
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
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

  // Check if item is playable (podcast or video)
  $: isPlayable =
    feedType === "podcast" ||
    feedType === "youtube" ||
    item.enclosure ||
    item.external_id;
</script>

<article
  class="group relative flex flex-col w-full overflow-hidden rounded-2xl glass transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.08] {currentStyle.border} {currentStyle.glow} cursor-pointer"
  on:click={handleOpen}
  on:keypress={(e) => e.key === "Enter" && handleOpen()}
  tabindex="0"
  role="button"
>
  <!-- Image Preview (Conditional) -->
  {#if item.media_thumbnail}
    <div class="relative w-full aspect-video overflow-hidden">
      <img
        src={item.media_thumbnail}
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
      </div>
    </div>
  {:else}
    <!-- No Image: Header strip -->
    <div class="px-5 pt-5 pb-2 flex items-center gap-2">
      <div
        class="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/5"
      >
        <svelte:component this={Icon} size={12} class={currentStyle.color} />
        <span
          class="text-[10px] font-medium tracking-wide text-white/60 uppercase"
          >{item.feed_title}</span
        >
      </div>
    </div>
  {/if}

  <!-- Content Body -->
  <div class="flex flex-col flex-1 p-5 pt-3">
    <!-- Meta -->
    <div class="flex items-center justify-between mb-2 text-xs text-white/40">
      <span>{dateStr}</span>
      {#if item.is_read}
        <span class="text-white/20 flex items-center gap-1"
          ><CheckCircle2 size={12} /> Read</span
        >
      {/if}
    </div>

    <!-- Title -->
    <h3
      class="text-base font-semibold text-gray-100 leading-tight line-clamp-2 md:line-clamp-3 mb-2 group-hover:text-white transition-colors {item.is_read
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
          class="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-orange-400 transition-colors"
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
          class="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-blue-400 transition-colors"
          title="Open Link"
          on:click|stopPropagation
        >
          <ExternalLink size={18} />
        </a>
      </div>
    </div>
  </div>
</article>
