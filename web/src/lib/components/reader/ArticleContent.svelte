<script lang="ts">
  import {
    Sparkles,
    Database,
    ExternalLink,
    Play,
    Clock,
    Radio,
    Pause,
    SkipBack,
    SkipForward,
  } from "lucide-svelte";
  import type { Item, ReaderData } from "$lib/types";
  import { calculateReadTime, formatReadTime } from "$lib/utils/readTime";
  import { formatDuration } from "$lib/utils/formatDuration";
  import { sanitizeHtml } from "$lib/utils/sanitize";
  import {
    currentMedia,
    isPlaying,
    progress,
    formattedCurrentTime,
    formattedDuration,
    duration,
    playbackSpeed,
    seek,
    skip,
    togglePlayPause,
    setPlaybackSpeed,
  } from "$lib/stores/media";

  export let readerData: ReaderData | null = null;
  export let item: Item | null;
  export let summary: string | null;
  export let summaryLoading: boolean;
  export let fontSizeClass: string;
  export let fontFamilyClass: string;
  export let maxWidthClass: string;
  export let themeClass: string;
  export let onPlay: (() => void) | null = null;

  let heroImageError = false;

  function handleHeroImageError() {
    heroImageError = true;
  }

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  }

  function formatContent(html: string): string {
    if (!html) return "";
    let cleaned = html.trim();
    if (cleaned.toLowerCase().includes("<p>")) return cleaned;
    
    if (cleaned.includes("\n\n")) {
      return cleaned
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => `<p>${p.replace(/\n/g, " ").replace(/\s+/g, " ").trim()}</p>`)
        .join("");
    }

    if (cleaned.toLowerCase().includes("<br")) {
      const withParas = cleaned.replace(/<br\s*\/?>(\s*<br\s*\/?>\s*)+/gi, "</p><p>");
      return withParas.toLowerCase().startsWith("<p>") ? withParas : `<p>${withParas}</p>`;
    }

    return `<p>${cleaned}</p>`;
  }

  function formatSummary(text: string) {
    if (!text) return "";
    let html = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^\s*-\s+(.*)/gm, "<li>$1</li>");

    html = html.replace(/((<li>.*<\/li>\n?)+)/g, '<ul class="list-disc pl-5 my-3 space-y-1 text-white/80">$1</ul>');

    return html
      .split("\n\n")
      .map((p) => {
        if (p.trim().startsWith("<ul") || p.trim().startsWith("<li>")) return p.trim();
        return `<p class="mb-3 text-white/90 leading-relaxed">${p.trim()}</p>`;
      })
      .join("");
  }

  $: isYouTube =
    item?.source === "youtube" ||
    (readerData?.url &&
      (readerData.url.includes("youtube.com/watch") ||
        readerData.url.includes("youtu.be/")));
  $: isPodcast = item?.source === "podcast" || Boolean(item?.enclosure);
  $: isReddit = item?.source === "reddit";
  $: coverImage = isPodcast
    ? item?.feed_icon_url || readerData?.imageUrl || item?.media_thumbnail || null
    : (readerData?.imageUrl || item?.media_thumbnail || null);
  $: coverUrl = heroImageError
    ? item?.feed_icon_url || null
    : (coverImage || item?.feed_icon_url || null);
  $: heroStyle = coverUrl ? `--hero-image: url("${coverUrl}")` : "";
  $: feedTitle = item?.feed_title || readerData?.siteName || "FeedStream";
  $: displayAuthor = readerData?.byline || item?.author || null;
  $: displayDate = formatDate(item?.published || item?.created_at || null);
  $: readingMinutes = readerData?.contentHtml
    ? calculateReadTime(readerData.contentHtml)
    : 0;
  $: readTimeLabel =
    !isPodcast && !isYouTube && readingMinutes
      ? formatReadTime(readingMinutes)
      : null;
  $: durationLabel =
    isPodcast && item?.media_duration_seconds
      ? formatDuration(item.media_duration_seconds)
      : null;
  $: hasProgress = isPodcast && (item?.playback_position || 0) > 5;
  $: playLabel = isPodcast ? (hasProgress ? "Resume" : "Listen") : "Play";
  $: metaParts = [
    displayAuthor,
    displayDate,
    readTimeLabel,
    durationLabel
  ].filter((part): part is string => Boolean(part));

  $: if (item?.id) {
    heroImageError = false;
  }

  $: isCurrentPodcast =
    Boolean(item?.id) && $currentMedia?.id === item?.id && isPodcast;

  function handleHeroSeek(event: MouseEvent) {
    const target = event.currentTarget as HTMLDivElement | null;
    if (!target || !$currentMedia || !$currentMedia.id) return;
    const rect = target.getBoundingClientRect();
    const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const total = $duration || $currentMedia.media_duration_seconds || 0;
    const newTime = percent * total;
    if (newTime > 0 && total > 0) {
      seek(newTime);
    }
  }

  const speedOptions = [1, 1.25, 1.5, 2];

  function cycleHeroSpeed() {
    const current = speedOptions.indexOf($playbackSpeed);
    const next = speedOptions[(current + 1) % speedOptions.length];
    setPlaybackSpeed(next);
  }

  function stripInlineImages(html: string): string {
    if (!html) return "";
    return html
      .replace(/<figure[^>]*>\s*<img[^>]*>\s*<\/figure>/gi, "")
      .replace(/<img[^>]*>/gi, "");
  }

  $: bodyHtml = isReddit ? stripInlineImages(readerData?.contentHtml || "") : (readerData?.contentHtml || "");
</script>

<article class="reader-content {themeClass}">
  <header class="studio-hero" style={heroStyle}>
    <div class="hero-overlay">
      <div class="hero-chips">
        {#if coverUrl}
          <img
            src={coverUrl}
            alt=""
            class="hero-badge"
            on:error={handleHeroImageError}
          />
        {:else}
          <div class="hero-badge hero-badge-fallback">
            <Radio size={16} class="text-white/50" />
          </div>
        {/if}
        <span class="hero-chip">{feedTitle}</span>
        {#if isPodcast}
          <span class="hero-chip hero-chip-accent">
            <Radio size={12} />
            Podcast
          </span>
        {/if}
        {#if readerData?.fromCache}
          <span class="hero-chip hero-chip-muted">
            <Database size={12} />
            Offline
          </span>
        {/if}
      </div>

      <h1 class="hero-title" id="reader-title">
        {readerData.title || "Untitled"}
      </h1>

      {#if metaParts.length}
        <div class="hero-meta">
          {#each metaParts as part, index}
            <span class="hero-meta-item">
              {#if part === readTimeLabel}
                <Clock size={12} />
              {/if}
              {part}
            </span>
            {#if index < metaParts.length - 1}
              <span class="hero-meta-dot">•</span>
            {/if}
          {/each}
        </div>
      {/if}

      <div class="hero-actions">
        {#if isPodcast && onPlay}
          <button class="hero-action hero-action-primary" on:click={onPlay}>
            <Play size={16} class="fill-current" />
            {playLabel}
          </button>
        {/if}
        {#if readerData.url}
          <a
            href={readerData.url}
            target="_blank"
            rel="noopener noreferrer"
            class="hero-action hero-action-ghost"
            title="Open Original"
          >
            <ExternalLink size={16} />
            Open Original
          </a>
        {/if}
      </div>

      {#if isCurrentPodcast}
        <div class="hero-player">
          <div class="hero-player-controls">
            <button class="hero-player-icon" on:click={() => skip(-15)} title="Rewind 15s">
              <SkipBack size={16} />
            </button>
            <button class="hero-player-btn" on:click={togglePlayPause}>
              {#if $isPlaying}
                <Pause size={16} class="fill-current" />
              {:else}
                <Play size={16} class="fill-current" />
              {/if}
              <span>{$isPlaying ? "Pause" : "Play"}</span>
            </button>
            <button class="hero-player-icon" on:click={() => skip(30)} title="Forward 30s">
              <SkipForward size={16} />
            </button>
            <button class="hero-player-speed" on:click={cycleHeroSpeed}>
              {$playbackSpeed}x
            </button>
          </div>
          <div
            class="hero-player-progress"
            role="slider"
            aria-label="Audio Progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={$progress}
            aria-valuetext="{$formattedCurrentTime} of {$formattedDuration}"
            tabindex="0"
            on:click={handleHeroSeek}
            on:keypress={(e) => (e.key === 'Enter' || e.key === ' ') ? handleHeroSeek(e) : null}
          >
            <div
              class="hero-player-progress-fill"
              style="width: {$progress}%"
            ></div>
          </div>
          <div class="hero-player-time">
            <span>{$formattedCurrentTime}</span>
            <span>/</span>
            <span>{$formattedDuration}</span>
          </div>
        </div>
      {/if}
    </div>
  </header>

  {#if summary}
    <div class="mb-10 p-6 bg-accent/10 border border-accent/20 rounded-xl relative overflow-hidden group">
      <div class="absolute top-0 left-0 w-1 h-full bg-accent"></div>
      <div class="flex items-center gap-2 mb-4 text-accent text-sm font-bold uppercase tracking-wider">
        <Sparkles size={14} />
        AI Summary
      </div>
      <div class="prose prose-invert prose-sm max-w-none font-sans">
        {@html sanitizeHtml(formatSummary(summary))}
      </div>
    </div>
  {:else if summaryLoading}
    <div class="mb-10 p-6 bg-white/5 border border-white/10 rounded-xl animate-pulse">
      <div class="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
      <div class="space-y-3">
        <div class="h-3 bg-white/10 rounded w-full"></div>
        <div class="h-3 bg-white/10 rounded w-5/6"></div>
        <div class="h-3 bg-white/10 rounded w-4/6"></div>
      </div>
    </div>
  {/if}

  {#if !isPodcast}
    <div
      class="reader-body {fontSizeClass} {fontFamilyClass} mx-auto w-full max-w-none"
      id="reader-body-content"
    >
      {#if !isYouTube}
        {@html sanitizeHtml(formatContent(bodyHtml))}
      {/if}
    </div>
  {/if}
</article>

<style>
  .reader-content {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .studio-hero {
    position: relative;
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid var(--divider, rgba(255, 255, 255, 0.1));
    background: rgba(10, 12, 18, 0.85);
    background-size: cover;
    background-position: center;
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
  }

  .studio-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image: var(--hero-image, none);
    background-size: cover;
    background-position: center;
    filter: blur(22px);
    transform: scale(1.08);
    opacity: 0.7;
  }

  .studio-hero::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(600px circle at 15% 10%, rgba(var(--accent-color-rgb, 56, 189, 248), 0.2), transparent 60%),
      linear-gradient(180deg, rgba(10, 10, 15, 0.2), rgba(10, 10, 15, 0.75));
  }

  .hero-overlay {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 26px;
    z-index: 1;
  }

  .hero-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .hero-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: rgba(0, 0, 0, 0.35);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.85);
  }

  .hero-chip-accent {
    background: rgba(var(--accent-color-rgb, 56, 189, 248), 0.18);
    border-color: rgba(var(--accent-color-rgb, 56, 189, 248), 0.5);
    color: #fff;
  }

  .hero-chip-muted {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.7);
  }

  .hero-title {
    font-size: clamp(26px, 4vw, 38px);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .hero-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 13px;
    font-weight: 500;
  }

  .hero-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .hero-meta-dot {
    opacity: 0.4;
  }

  .hero-actions {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .hero-action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid transparent;
    text-decoration: none;
    color: inherit;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }

  .hero-action-primary {
    background: var(--accent-color);
    color: #fff;
    box-shadow: 0 12px 24px rgba(var(--accent-color-rgb, 56, 189, 248), 0.28);
  }

  .hero-action-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 16px 32px rgba(var(--accent-color-rgb, 56, 189, 248), 0.35);
  }

  .hero-action-ghost {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .hero-action-ghost:hover {
    transform: translateY(-1px);
    background: rgba(255, 255, 255, 0.14);
  }

  .hero-player {
    margin-top: 14px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(6, 8, 12, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(8px);
  }

  .hero-player-controls {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .hero-player-icon {
    width: 34px;
    height: 34px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .hero-player-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(var(--accent-color-rgb, 56, 189, 248), 0.2);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    border: 1px solid rgba(var(--accent-color-rgb, 56, 189, 248), 0.4);
  }

  .hero-player-speed {
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .hero-player-progress {
    flex: 1;
    min-width: 140px;
    height: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
    cursor: pointer;
  }

  .hero-player-progress-fill {
    height: 100%;
    background: var(--accent-color);
  }

  .hero-player-time {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    font-variant-numeric: tabular-nums;
  }

  .hero-badge {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    object-fit: cover;
    border: 1px solid rgba(255, 255, 255, 0.2);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.4);
    flex-shrink: 0;
  }

  .hero-badge-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
  }

  @media (min-width: 768px) {
    .hero-overlay {
      padding: 34px 38px;
      gap: 16px;
    }
  }

  .reader-body {
    line-height: 1.8;
    letter-spacing: 0.01em;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
    width: 100%;
    max-width: 100%;
  }

  .reader-body :global(h1) {
    display: none;
  }

  .reader-body :global(p) {
    margin-bottom: 1.75em;
  }

  .reader-body :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 24px 0;
  }

  .reader-body :global(h2),
  .reader-body :global(h3) {
    margin-top: 2em;
    margin-bottom: 1em;
    font-weight: 700;
    line-height: 1.3;
  }

  .reader-body :global(blockquote) {
    border-left: 4px solid var(--accent-color);
    padding-left: 1.5em;
    margin: 2em 0;
    font-style: italic;
    opacity: 0.9;
  }

  .reader-body :global(pre) {
    background: rgba(128, 128, 128, 0.1);
    padding: 1.5em;
    border-radius: 12px;
    overflow-x: auto;
    margin: 2em 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.9em;
  }
</style>
