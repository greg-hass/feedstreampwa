<script lang="ts">
  import {
    showReader,
    readerData,
    readerLoading,
    readerError,
    currentItem,
    closeReader,
  } from "$lib/stores/reader";
  import { readerSettings } from "$lib/stores/readerSettings";
  import { calculateReadTime } from "$lib/utils/readTime";
  import ReaderControls from "$lib/components/ReaderControls.svelte";
  import ReadingProgress from "$lib/components/ReadingProgress.svelte";
  import {
    Sparkles,
    MessageSquare,
    ExternalLink,
    MessageCircle,
    Database,
    Share2,
    PictureInPicture,
  } from "lucide-svelte";
  import OfflineBadge from "$lib/components/OfflineBadge.svelte";

  let summary: string | null = null;
  let summaryLoading = false;

  async function handleSummarize() {
    if (!$currentItem) return;
    summaryLoading = true;
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: $currentItem.id }),
      });
      const data = await res.json();
      if (data.ok) {
        summary = data.summary;
      }
    } catch (e) {
      console.error(e);
    } finally {
      summaryLoading = false;
    }
  }

  // Reset summary when item changes
  $: if ($currentItem?.id) {
    summary = null;
    summaryLoading = false;
    // Reset discussions
    discussions = [];
    showDiscussions = false;
    fetchDiscussions();
  }

  // Discussions Logic
  let showDiscussions = false;
  let discussions: any[] = [];
  let discussionsLoading = false;

  async function fetchDiscussions() {
    if (!$currentItem?.url) return;
    discussionsLoading = true;
    try {
      const res = await fetch(
        `/api/discussions?url=${encodeURIComponent($currentItem.url)}`
      );
      const data = await res.json();
      if (data.ok) {
        discussions = data.discussions;
      }
    } catch (e) {
      console.error("Failed to fetch discussions", e);
    } finally {
      discussionsLoading = false;
    }
  }

  function toggleDiscussions() {
    showDiscussions = !showDiscussions;
  }

  // Share functionality
  async function handleShare() {
    if (!$currentItem && !$readerData?.url) return;

    const shareData = {
      title:
        $readerData?.title || $currentItem?.title || "Article from FeedStream",
      text: $readerData?.excerpt || $currentItem?.summary || undefined,
      url: $readerData?.url || $currentItem?.url || window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareData.url || "");
        alert("Link copied to clipboard!");
      }
    } catch (e) {
      console.error("Failed to share:", e);
    }
  }

  // Picture-in-Picture functionality
  let isInPiP = false;

  async function togglePiP() {
    if (!ytPlayer) return;

    try {
      const iframe = document.querySelector(
        "#yt-player-container iframe"
      ) as HTMLIFrameElement;
      if (!iframe) return;

      if (isInPiP) {
        // Exit PiP by exiting document picture-in-picture
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
          isInPiP = false;
        }
      } else {
        // Request PiP for the video element inside iframe
        // Note: YouTube iframe PiP is tricky due to cross-origin
        // We'll use a workaround by checking if the video supports it
        const video = iframe.contentWindow?.document?.querySelector("video");
        if (video && (video as any).requestPictureInPicture) {
          await (video as any).requestPictureInPicture();
          isInPiP = true;
        } else {
          // Fallback: Try to open YouTube in PiP via URL parameter
          // This won't work in embedded players due to YouTube restrictions
          alert(
            "PiP is not available for this video. Try opening it in the YouTube app."
          );
        }
      }
    } catch (e) {
      console.error("PiP error:", e);
      // Many browsers block iframe PiP due to security
      alert(
        "Picture-in-Picture is restricted for embedded YouTube videos. Use the YouTube app for PiP."
      );
    }
  }

  // Listen for PiP exit events
  if (typeof document !== "undefined") {
    document.addEventListener("leavepictureinpicture", () => {
      isInPiP = false;
    });
  }

  let ytPlayer: any = null;
  let ytProgressInterval: ReturnType<typeof setInterval> | null = null;
  let ytApiLoaded = false;
  let scrollContainer: HTMLElement | null = null;
  let readTime = 0;

  // Calculate read time when content changes
  $: if ($readerData?.contentHtml) {
    readTime = calculateReadTime($readerData.contentHtml);
  }

  // Dynamic styles based on reader settings
  $: fontSizeClass = {
    small: "text-base",
    medium: "text-lg",
    large: "text-xl",
    xlarge: "text-2xl",
  }[$readerSettings.fontSize];

  $: fontFamilyClass = {
    sans: "font-sans",
    serif: "font-serif",
    mono: "font-mono",
  }[$readerSettings.fontFamily];

  $: maxWidthClass = {
    narrow: "max-w-2xl",
    medium: "max-w-3xl",
    wide: "max-w-4xl",
  }[$readerSettings.readingWidth];

  $: if ($showReader && $readerData && typeof document !== "undefined") {
    setTimeout(() => {
      const container = document.getElementById("reader-body-content");
      if (container) {
        container.querySelectorAll("a").forEach((link: HTMLAnchorElement) => {
          link.target = "_blank";
          link.rel = "noopener noreferrer";
        });
      }
    }, 0);
  }

  function initYouTubePlayer() {
    if (!ytApiLoaded) {
      loadYouTubeAPI();
      return;
    }

    if (!$readerData?.url) return;

    let videoId = null;
    if ($readerData.url.includes("v=")) {
      videoId = $readerData.url.split("v=")[1]?.split("&")[0];
    } else if ($readerData.url.includes("youtu.be/")) {
      videoId = $readerData.url.split("youtu.be/")[1]?.split("?")[0];
    } else if ($currentItem?.external_id) {
      videoId = $currentItem.external_id;
    }

    if (!videoId) return;

    setTimeout(() => {
      const container = document.getElementById("yt-player-container");
      if (!container) return;

      if (ytPlayer) {
        try {
          ytPlayer.destroy();
        } catch (e) {}
      }

      const startPos = Math.floor($currentItem?.playback_position || 0);

      ytPlayer = new (window as any).YT.Player("yt-player-container", {
        height: "100%",
        width: "100%",
        videoId: videoId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          modestbranding: 1,
          rel: 0,
          start: startPos,
        },
        events: {
          onStateChange: onPlayerStateChange,
        },
      });
    }, 100);
  }

  function loadYouTubeAPI() {
    if ((window as any).YT) {
      ytApiLoaded = true;
      initYouTubePlayer();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true;
      initYouTubePlayer();
    };
  }

  function onPlayerStateChange(event: any) {
    if (event.data === (window as any).YT.PlayerState.PLAYING) {
      startProgressSync();
    } else {
      stopProgressSync();
      syncPlaybackPosition();
    }
  }

  function startProgressSync() {
    if (ytProgressInterval) clearInterval(ytProgressInterval);
    ytProgressInterval = setInterval(syncPlaybackPosition, 5000);
  }

  function stopProgressSync() {
    if (ytProgressInterval) {
      clearInterval(ytProgressInterval);
      ytProgressInterval = null;
    }
  }

  async function syncPlaybackPosition() {
    if (!ytPlayer || !ytPlayer.getCurrentTime || !$currentItem) return;

    const currentTime = ytPlayer.getCurrentTime();
    // Optimistic update in local item state if we had access to items store action
    // But currentItem is a copy in the reader store.
    // Ideally we call an action from items store.
    // For now let's just do the fetch.

    try {
      await fetch(`/api/items/${$currentItem.id}/playback-position`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: currentTime }),
      });
    } catch (e) {
      console.error("Failed to sync playback position:", e);
    }
  }

  function handleClose() {
    stopProgressSync();
    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch (e) {}
      ytPlayer = null;
    }
    closeReader();
  }

  function handleOverlayKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClose();
    }
  }

  function formatContent(html: string): string {
    if (!html) return "";

    // Clean up the HTML first
    let cleaned = html.trim();

    // If it already has paragraphs, just ensure proper spacing
    if (cleaned.toLowerCase().includes("<p>")) {
      return cleaned;
    }

    // Convert double line breaks to paragraph breaks
    if (cleaned.includes("\n\n")) {
      const paragraphs = cleaned
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((p) => {
          // Replace single line breaks within paragraphs with spaces
          const text = p.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
          return text ? `<p>${text}</p>` : "";
        })
        .filter((p) => p.length > 0);

      return paragraphs.join("");
    }

    // If it has <br> tags, convert double breaks to paragraphs
    if (cleaned.toLowerCase().includes("<br")) {
      const withParas = cleaned.replace(
        /<br\s*\/?>(\s*<br\s*\/?>\s*)+/gi,
        "</p><p>"
      );
      // Wrap in paragraph tags if not already
      if (!withParas.toLowerCase().startsWith("<p>")) {
        return `<p>${withParas}</p>`;
      }
      return withParas;
    }

    // Otherwise, wrap the entire content in a paragraph
    return `<p>${cleaned}</p>`;
  }

  function formatSummary(text: string) {
    if (!text) return "";
    // Basic Markdown to HTML
    let html = text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^\s*-\s+(.*)/gm, "<li>$1</li>");

    // Wrap lists
    html = html.replace(
      /((<li>.*<\/li>\n?)+)/g,
      '<ul class="list-disc pl-5 my-3 space-y-1 text-white/80">$1</ul>'
    );

    // Paragraphs (lines not in lists)
    html = html
      .split("\n\n")
      .map((p) => {
        if (p.trim().startsWith("<ul")) return p.trim();
        if (p.trim().startsWith("<li>")) return p.trim();
        return `<p class="mb-3 text-white/90 leading-relaxed">${p.trim()}</p>`;
      })
      .join("");

    return html;
  }
</script>

{#if $showReader}
  <div
    class="reader-overlay"
    on:click={handleClose}
    on:keydown={handleOverlayKeydown}
    role="button"
    tabindex="0"
    aria-label="Close reader view"
  >
    <div
      class="reader-container"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-title"
    >
      <!-- Reading Progress Bar -->
      <ReadingProgress {scrollContainer} />

      <div class="reader-header">
        <button class="reader-close" on:click={handleClose} title="Close (ESC)">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 5l10 10M15 5l-10 10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>

        <div class="flex items-center gap-3">
          <button
            class="p-2 text-white/50 hover:text-accent disabled:opacity-50 transition-colors hidden md:block"
            on:click={handleSummarize}
            disabled={summaryLoading || !!summary}
            title="Summarize with AI"
          >
            <Sparkles size={20} class={summaryLoading ? "animate-pulse" : ""} />
          </button>

          <button
            class="p-2 text-white/50 hover:text-accent transition-colors relative"
            on:click={toggleDiscussions}
            title="View Discussions (HN/Reddit)"
          >
            <MessageSquare size={20} />
            {#if discussions.length > 0}
              <span
                class="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full"
              ></span>
            {/if}
          </button>

          <!-- Share Button -->
          <button
            class="p-2 text-white/50 hover:text-accent transition-colors"
            on:click={handleShare}
            title="Share article"
          >
            <Share2 size={20} />
          </button>

          <!-- PiP Button (only for YouTube videos) -->
          {#if $readerData?.url && ($readerData.url.includes("youtube.com/watch") || $readerData.url.includes("youtu.be/"))}
            <button
              class="p-2 text-white/50 hover:text-accent transition-colors {isInPiP
                ? 'text-accent'
                : ''}"
              on:click={togglePiP}
              title={isInPiP ? "Exit Picture-in-Picture" : "Picture-in-Picture"}
            >
              <PictureInPicture size={20} />
            </button>
          {/if}

          <ReaderControls content={$readerData?.contentHtml || ""} {readTime} />
          {#if $readerData?.url}
            <a
              href={$readerData.url}
              target="_blank"
              rel="noopener noreferrer"
              class="reader-source"
            >
              Open Original ↗
            </a>
          {/if}
        </div>
      </div>

      <div class="reader-scroll-container" bind:this={scrollContainer}>
        {#if $readerLoading}
          <div class="reader-loading">
            <div class="reader-spinner"></div>
            <span>Loading article...</span>
          </div>
        {:else if $readerError}
          <div class="reader-error">
            <p>{$readerError}</p>
            {#if $readerData?.url}
              <a
                href={$readerData.url}
                target="_blank"
                rel="noopener noreferrer"
                class="reader-fallback-btn"
              >
                Open Original Article
              </a>
            {/if}
          </div>
        {:else if $readerData}
          <article class="reader-content">
            <h1 class="reader-title" id="reader-title">
              {$readerData.title || "Untitled"}
            </h1>

            {#if summary}
              <div
                class="mb-10 p-6 bg-accent/10 border border-accent/20 rounded-xl relative overflow-hidden group"
              >
                <div class="absolute top-0 left-0 w-1 h-full bg-accent"></div>
                <div
                  class="flex items-center gap-2 mb-4 text-accent text-sm font-bold uppercase tracking-wider"
                >
                  <Sparkles size={14} />
                  AI Summary
                </div>
                <div class="prose prose-invert prose-sm max-w-none font-sans">
                  {@html formatSummary(summary)}
                </div>
              </div>
            {:else if summaryLoading}
              <div
                class="mb-10 p-6 bg-white/5 border border-white/10 rounded-xl animate-pulse"
              >
                <div class="h-4 bg-white/10 rounded w-1/4 mb-4"></div>
                <div class="space-y-3">
                  <div class="h-3 bg-white/10 rounded w-full"></div>
                  <div class="h-3 bg-white/10 rounded w-5/6"></div>
                  <div class="h-3 bg-white/10 rounded w-4/6"></div>
                </div>
              </div>
            {/if}
            {#if $readerData.byline || $readerData.siteName || $readerData.fromCache}
              <div class="reader-meta">
                {#if $readerData.byline}<span>{$readerData.byline}</span>{/if}
                {#if $readerData.byline && $readerData.siteName}<span
                    class="meta-sep">•</span
                  >{/if}
                {#if $readerData.siteName}<span>{$readerData.siteName}</span
                  >{/if}
                {#if ($readerData.byline || $readerData.siteName) && $readerData.fromCache}<span
                    class="meta-sep">•</span
                  >{/if}
                {#if $readerData.fromCache}
                  <span class="flex items-center gap-1 text-emerald-400">
                    <Database size={12} />
                    Offline
                  </span>
                {/if}
              </div>
            {/if}

            {#if $readerData.url && ($readerData.url.includes("youtube.com/watch") || $readerData.url.includes("youtu.be/"))}
              <div
                class="video-wrapper"
                style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; margin-bottom: 24px; background: #000;"
              >
                <div
                  id="yt-player-container"
                  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                ></div>
              </div>
            {/if}

            {#if $readerData.imageUrl && !($readerData.url && ($readerData.url.includes("youtube.com/watch") || $readerData.url.includes("youtu.be/")))}
              <img src={$readerData.imageUrl} alt="" class="reader-hero" />
            {/if}
            <div
              class="reader-body {fontSizeClass} {fontFamilyClass} {maxWidthClass} mx-auto"
              id="reader-body-content"
            >
              {#if !($readerData.url && ($readerData.url.includes("youtube.com/watch") || $readerData.url.includes("youtu.be/")))}
                {@html formatContent($readerData.contentHtml)}
              {/if}
            </div>
          </article>
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if showDiscussions}
  <div class="discussions-panel">
    <div
      class="p-4 border-b border-white/10 flex items-center justify-between bg-[#0a0a0c]"
    >
      <h3 class="font-bold text-lg text-white flex items-center gap-2">
        <MessageSquare size={18} class="text-accent" />
        Context
      </h3>
      <button
        class="p-1 hover:bg-white/10 rounded"
        on:click={() => (showDiscussions = false)}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          ><path
            d="M15 5L5 15M5 5l10 10"
            stroke-width="2"
            stroke-linecap="round"
          /></svg
        >
      </button>
    </div>
    <div class="p-4 overflow-y-auto h-[calc(100vh-60px)]">
      {#if discussionsLoading}
        <div class="flex flex-col items-center py-10 text-white/50 gap-3">
          <div
            class="w-6 h-6 border-2 border-white/20 border-t-accent rounded-full animate-spin"
          ></div>
          <span class="text-sm">Searching communities...</span>
        </div>
      {:else if discussions.length === 0}
        <div class="text-center py-10 text-white/50">
          <p>No discussions found on Hacker News or Reddit.</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each discussions as discussion}
            <a
              href={discussion.url}
              target="_blank"
              rel="noopener noreferrer"
              class="block p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group"
            >
              <div class="flex items-start gap-3">
                <div class="shrink-0 mt-1">
                  {#if discussion.source === "hackernews"}
                    <div
                      class="w-6 h-6 flex items-center justify-center bg-[#ff6600] text-white font-bold text-xs rounded"
                    >
                      Y
                    </div>
                  {:else}
                    <div
                      class="w-6 h-6 flex items-center justify-center bg-[#ff4500] text-white font-bold text-xs rounded-full"
                    >
                      R
                    </div>
                  {/if}
                </div>
                <div class="flex-1 min-w-0">
                  <h4
                    class="text-sm font-medium text-white/90 leading-snug mb-1 group-hover:text-accent transition-colors line-clamp-2"
                  >
                    {discussion.title}
                  </h4>
                  <div class="flex items-center gap-3 text-xs text-white/50">
                    <span class="flex items-center gap-1">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        ><path d="M12 20v-6M6 20V10M18 20V4" /></svg
                      >
                      {discussion.score}
                    </span>
                    <span class="flex items-center gap-1">
                      <MessageCircle size={12} />
                      {discussion.commentsCount}
                    </span>
                    {#if discussion.subreddit}
                      <span class="text-white/40">r/{discussion.subreddit}</span
                      >
                    {/if}
                  </div>
                </div>
                <ExternalLink
                  size={14}
                  class="text-white/20 group-hover:text-white/60 shrink-0"
                />
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .discussions-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 350px;
    height: 100vh;
    background: #050507;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 2005; /* Above reader overlay (2000) */
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
    animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  @media (max-width: 640px) {
    .discussions-panel {
      width: 100%;
    }
  }
  /* Existing styles continue... */
  .reader-overlay {
    position: fixed;
    inset: 0;
    background: #050507;
    z-index: 2000;
    display: flex;
    justify-content: center;
    overflow: hidden; /* No scroll on overlay */
    animation: fadeIn 0.2s ease;
  }

  .reader-container {
    width: 100%;
    max-width: 720px;
    height: 100vh; /* Full viewport height */
    display: flex;
    flex-direction: column;
    padding: 0;
    animation: scaleIn 0.25s ease-out;
    background: #050507;
  }

  .reader-scroll-container {
    flex: 1;
    overflow-y: auto;
    padding: 24px 16px;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  @media (min-width: 769px) {
    .reader-scroll-container {
      padding: 32px 40px;
    }

    /* On desktop, maybe give it some breathing room if desired, 
       but user requested fixing scroll bleed, so full height column is safest.
       We can keep it centered 720px max-width though. */
  }

  .reader-header {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #050507; /* Solid background */
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 16px 20px;
    z-index: 50;
  }

  .reader-close {
    width: 40px;
    height: 40px;
    background: var(--panel1);
    border: 1px solid var(--stroke);
    border-radius: 50%;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .reader-close:hover {
    background: var(--chip-hover);
    color: var(--text);
    transform: rotate(90deg);
  }

  .reader-source {
    color: var(--accent);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    padding: 8px 14px;
    border: 1px solid var(--accent);
    border-radius: 99px;
    transition: all 0.2s;
  }

  .reader-source:hover {
    background: var(--accent);
    color: var(--bg0);
  }

  .reader-loading,
  .reader-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 80px 20px;
    text-align: center;
    color: var(--muted);
  }

  .reader-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--stroke);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .reader-error {
    color: var(--muted2);
  }

  .reader-fallback-btn {
    color: var(--accent);
    text-decoration: none;
    padding: 12px 24px;
    border: 1px solid var(--accent);
    border-radius: var(--radiusM);
    transition: all 0.2s;
  }

  .reader-fallback-btn:hover {
    background: var(--accent);
    color: var(--bg0);
  }

  .reader-content {
    color: var(--text);
    padding-bottom: 60px; /* Extra bottom padding for comfortable scrolling */
  }

  .reader-hero {
    width: 100%;
    max-height: 400px;
    object-fit: cover;
    border-radius: var(--radiusM);
    margin-bottom: 40px;
  }

  .reader-title {
    font-family: var(--font-display);
    font-size: 34px;
    font-weight: 700;
    line-height: 1.2;
    letter-spacing: -0.025em;
    margin: 0 0 20px 0;
    color: #fff;
    text-wrap: balance; /* Modern text balancing for better line breaks */
  }

  .reader-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 15px;
    color: var(--muted);
    margin-bottom: 40px;
    padding-bottom: 28px;
    border-bottom: 1px solid var(--stroke);
  }

  .meta-sep {
    color: var(--muted);
  }

  .reader-body {
    font-size: 19px;
    line-height: 1.85;
    color: rgba(255, 255, 255, 0.9);
    text-align: left;
    word-spacing: 0.05em;
    hyphens: auto;
    -webkit-hyphens: auto;
  }

  /* Paragraph styling - the key to good readability */
  .reader-body p {
    margin: 0 0 1.75em 0;
    text-align: justify;
    text-justify: inter-word;
  }

  /* First paragraph after heading - no indent, larger first letter optional */
  .reader-body h2 + p,
  .reader-body h3 + p,
  .reader-body h4 + p {
    text-indent: 0;
  }

  /* Links */
  .reader-body a {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
    text-decoration-thickness: 1px;
    transition: text-decoration-color 0.2s;
  }

  .reader-body a:hover {
    text-decoration-color: transparent;
  }

  /* Blockquotes - elegant styling */
  .reader-body blockquote {
    margin: 2em 0;
    padding: 1.25em 1.5em;
    border-left: 4px solid var(--accent);
    background: rgba(255, 255, 255, 0.03);
    border-radius: 0 8px 8px 0;
    color: rgba(255, 255, 255, 0.75);
    font-style: italic;
    line-height: 1.7;
  }

  .reader-body blockquote p {
    margin-bottom: 0.75em;
  }

  .reader-body blockquote p:last-child {
    margin-bottom: 0;
  }

  /* Code blocks */
  .reader-body pre,
  .reader-body code {
    background: var(--panel0);
    border-radius: 8px;
    font-family: "SF Mono", "Monaco", "Consolas", "Menlo", monospace;
    font-size: 0.88em;
  }

  .reader-body pre {
    padding: 20px;
    overflow-x: auto;
    margin: 2em 0;
    border: 1px solid var(--stroke);
  }

  .reader-body code {
    padding: 3px 8px;
  }

  .reader-body pre code {
    padding: 0;
    background: none;
  }

  /* Lists */
  .reader-body ul,
  .reader-body ol {
    margin: 1.75em 0;
    padding-left: 1.75em;
  }

  .reader-body li {
    margin-bottom: 0.75em;
    line-height: 1.7;
  }

  .reader-body li::marker {
    color: var(--accent);
  }

  /* Headings */
  .reader-body h2,
  .reader-body h3,
  .reader-body h4 {
    font-family: var(--font-display);
    color: #fff;
    letter-spacing: -0.01em;
    margin-top: 2.5em;
    margin-bottom: 1em;
  }

  .reader-body h2 {
    font-size: 26px;
    font-weight: 700;
    padding-bottom: 0.5em;
    border-bottom: 1px solid var(--stroke);
  }

  .reader-body h3 {
    font-size: 22px;
    font-weight: 600;
  }

  .reader-body h4 {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  /* Horizontal rule */
  .reader-body hr {
    border: none;
    border-top: 1px solid var(--stroke);
    margin: 3em 0;
  }

  /* Images in content */
  .reader-body img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 2em 0;
  }

  /* Figure captions */
  .reader-body figcaption {
    font-size: 14px;
    color: var(--muted);
    text-align: center;
    margin-top: 0.75em;
    font-style: italic;
  }

  /* Tables */
  .reader-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 2em 0;
    font-size: 0.95em;
  }

  .reader-body th,
  .reader-body td {
    padding: 12px 16px;
    border: 1px solid var(--stroke);
    text-align: left;
  }

  .reader-body th {
    background: rgba(255, 255, 255, 0.05);
    font-weight: 600;
  }

  /* Strong and emphasis */
  .reader-body strong {
    color: #fff;
    font-weight: 600;
  }

  .reader-body em {
    font-style: italic;
  }

  /* First letter drop cap (optional enhancement) */
  .reader-body > p:first-of-type::first-letter {
    font-size: 3.5em;
    font-weight: 700;
    float: left;
    line-height: 0.8;
    margin-right: 0.1em;
    margin-top: 0.1em;
    color: var(--accent);
  }
</style>
