<script lang="ts">
  import { onDestroy, onMount } from "svelte";
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
    ChevronLeft,
    ZoomIn,
    ZoomOut,
    Headphones,
    BookOpen,
    Share,
    Trash2,
  } from "lucide-svelte";
  import * as itemsApi from "$lib/api/items";
  import { toast } from "$lib/stores/toast";
  import { confirmDialog } from "$lib/stores/confirm";
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

  async function handleDelete() {
    if (!$currentItem) return;
    const itemId = $currentItem.id;

    const confirmed = await confirmDialog.confirm({
      title: "Delete Article",
      message:
        "Are you sure you want to delete this article? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      await itemsApi.deleteItem(itemId);
      toast.success("Article deleted");
      handleClose();
      // Force reload of feed list if possible, or just let users refresh
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    } catch (e) {
      console.error("Failed to delete item:", e);
      toast.error("Failed to delete article");
    }
  }

  // Share functionality
  async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    if (typeof document === "undefined") return false;
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (e) {
      copied = false;
    } finally {
      document.body.removeChild(textarea);
    }

    return copied;
  }

  async function handleShare() {
    if (!$currentItem && !$readerData?.url) return;

    const shareUrl =
      $readerData?.url ||
      $currentItem?.url ||
      (typeof window !== "undefined" ? window.location.href : "");

    if (!shareUrl) return;

    const shareData = {
      title:
        $readerData?.title || $currentItem?.title || "Article from FeedStream",
      text: $readerData?.excerpt || $currentItem?.summary || undefined,
      url: shareUrl,
    };

    try {
      const canShare =
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function";
      const supportsData =
        canShare && typeof navigator.canShare === "function"
          ? navigator.canShare(shareData)
          : canShare;

      if (supportsData) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        const copied = await copyToClipboard(shareData.url || "");
        if (copied) {
          alert("Link copied to clipboard!");
        } else {
          alert(`Copy this link: ${shareData.url || ""}`);
        }
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

  const handleLeavePiP = () => {
    isInPiP = false;
  };

  let ytPlayer: any = null;
  let ytProgressInterval: ReturnType<typeof setInterval> | null = null;
  let ytApiLoaded = false;
  let scrollContainer: HTMLElement | null = null;
  let readTime = 0;
  let linkTargetTimeout: ReturnType<typeof setTimeout> | null = null;
  let ytInitTimeout: ReturnType<typeof setTimeout> | null = null;
  let isDestroyed = false;

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

  $: themeClass = `theme-${$readerSettings.theme}`;

  function increaseFontSize() {
    const sizes: FontSize[] = ["small", "medium", "large", "xlarge"];
    const currentIndex = sizes.indexOf($readerSettings.fontSize);
    if (currentIndex < sizes.length - 1) {
      readerSettings.setFontSize(sizes[currentIndex + 1]);
    }
  }

  function decreaseFontSize() {
    const sizes: FontSize[] = ["small", "medium", "large", "xlarge"];
    const currentIndex = sizes.indexOf($readerSettings.fontSize);
    if (currentIndex > 0) {
      readerSettings.setFontSize(sizes[currentIndex - 1]);
    }
  }

  function formatDate(dateStr: string | undefined) {
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

  const themes: { id: ReaderTheme; color: string; label: string }[] = [
    { id: "light", color: "#FFFFFF", label: "Light" },
    { id: "sepia", color: "#F4ECD8", label: "Sepia" },
    { id: "dark", color: "#2B313E", label: "Dark" },
    { id: "black", color: "#000000", label: "Black" },
  ];

  function toggleTTS() {
    // We'll reuse the logic from ReaderControls or trigger it
    const controlsElement = document.querySelector(
      ".tts-trigger"
    ) as HTMLButtonElement;
    if (controlsElement) controlsElement.click();
  }

  $: if ($showReader && $readerData && typeof document !== "undefined") {
    if (linkTargetTimeout) {
      clearTimeout(linkTargetTimeout);
    }
    linkTargetTimeout = setTimeout(() => {
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

    if (ytInitTimeout) {
      clearTimeout(ytInitTimeout);
    }
    ytInitTimeout = setTimeout(() => {
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
      if (isDestroyed) return;
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

  onMount(() => {
    if (typeof document === "undefined") return;
    document.addEventListener("leavepictureinpicture", handleLeavePiP);
    return () => {
      document.removeEventListener("leavepictureinpicture", handleLeavePiP);
      document.body.style.overflow = "";
    };
  });

  $: if (typeof document !== "undefined") {
    document.body.style.overflow = $showReader ? "hidden" : "";
  }

  onDestroy(() => {
    isDestroyed = true;
    stopProgressSync();

    if (linkTargetTimeout) {
      clearTimeout(linkTargetTimeout);
      linkTargetTimeout = null;
    }

    if (ytInitTimeout) {
      clearTimeout(ytInitTimeout);
      ytInitTimeout = null;
    }

    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch (e) {}
      ytPlayer = null;
    }

    if (
      typeof window !== "undefined" &&
      (window as any).onYouTubeIframeAPIReady
    ) {
      (window as any).onYouTubeIframeAPIReady = null;
    }
  });

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

      <div class="reader-header-new">
        <div class="header-top">
          <button class="back-button" on:click={handleClose}>
            <ChevronLeft size={20} />
            <span>Back</span>
          </button>
        </div>

        <div class="header-controls-row">
          <div class="theme-picker">
            {#each themes as t}
              <button
                class="theme-circle {$readerSettings.theme === t.id
                  ? 'active'
                  : ''}"
                style="background-color: {t.color}"
                on:click={() => readerSettings.setTheme(t.id)}
                title={t.label}
              ></button>
            {/each}
          </div>

          <div class="zoom-controls">
            <button on:click={decreaseFontSize} title="Decrease Font Size">
              <ZoomOut size={18} />
            </button>
            <span class="zoom-level">
              {{ small: "80%", medium: "100%", large: "120%", xlarge: "140%" }[
                $readerSettings.fontSize
              ]}
            </span>
            <button on:click={increaseFontSize} title="Increase Font Size">
              <ZoomIn size={18} />
            </button>
          </div>

          <div class="control-divider"></div>

          <div class="action-buttons">
            <button
              on:click={handleDelete}
              title="Delete Article"
              class="hover:text-red-400 transition-colors"
            >
              <Trash2 size={20} />
            </button>
            <button on:click={handleShare} title="Share">
              <Share size={20} />
            </button>
            <button on:click={toggleTTS} title="Listen">
              <Headphones size={20} />
            </button>
          </div>
        </div>

        <!-- Hidden ReaderControls to reuse TTS logic -->
        <div class="hidden">
          <ReaderControls content={$readerData?.contentHtml || ""} {readTime} />
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
            {#if $currentItem?.url}
              <a
                href={$currentItem.url}
                target="_blank"
                rel="noopener noreferrer"
                class="reader-fallback-btn"
              >
                Open Original Article
              </a>
            {/if}
          </div>
        {:else if $readerData}
          <article class="reader-content {themeClass}">
            <div class="article-header">
              <h1 class="reader-title-new" id="reader-title">
                {$readerData.title || "Untitled"}
              </h1>

              <div class="article-meta-row">
                <span class="article-date">
                  {formatDate(
                    $currentItem?.published || $currentItem?.published_at
                  )}
                </span>
                <div class="article-actions-mini">
                  <button class="meta-action-btn" title="Mark as Read">
                    <BookOpen size={18} class="text-emerald-400" />
                  </button>
                  {#if $readerData.url}
                    <a
                      href={$readerData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="meta-action-btn"
                      title="Open Original"
                    >
                      <ExternalLink size={18} />
                    </a>
                  {/if}
                </div>
              </div>
              <div class="article-divider"></div>
            </div>

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
  .reader-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    justify-content: center;
    overflow: hidden;
    animation: fadeIn 0.2s ease;
  }

  .reader-container {
    width: 100%;
    max-width: 720px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 0;
    animation: scaleIn 0.25s ease-out;
  }

  .reader-scroll-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 24px 16px;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: none;
  }

  @media (min-width: 769px) {
    .reader-scroll-container {
      padding: 32px 40px;
    }
  }

  /* Redesigned Header */
  .reader-header-new {
    flex-shrink: 0;
    padding: 12px 20px;
    background: inherit;
    border-bottom: 1px solid rgba(128, 128, 128, 0.1);
    z-index: 50;
  }

  .header-top {
    margin-bottom: 16px;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 4px;
    color: inherit;
    opacity: 0.6;
    font-size: 14px;
    font-weight: 500;
    background: none;
    border: none;
    padding: 4px 0;
    cursor: pointer;
    transition: opacity 0.2s;
  }

  .back-button:hover {
    opacity: 1;
  }

  .header-controls-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .theme-picker {
    display: flex;
    gap: 12px;
  }

  .theme-circle {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid rgba(128, 128, 128, 0.2);
    cursor: pointer;
    transition:
      transform 0.2s,
      border-color 0.2s;
  }

  .theme-circle.active {
    border-color: #a855f7;
    transform: scale(1.15);
  }

  .zoom-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    color: inherit;
  }

  .zoom-controls button {
    background: none;
    border: none;
    color: inherit;
    padding: 4px;
    cursor: pointer;
    opacity: 0.7;
    display: flex;
    align-items: center;
  }

  .zoom-controls button:hover {
    opacity: 1;
  }

  .zoom-level {
    font-size: 14px;
    font-weight: 600;
    min-width: 45px;
    text-align: center;
    opacity: 0.8;
  }

  .control-divider {
    width: 1px;
    height: 20px;
    background: rgba(128, 128, 128, 0.2);
  }

  .action-buttons {
    display: flex;
    gap: 20px;
  }

  .action-buttons button {
    background: none;
    border: none;
    color: inherit;
    padding: 4px;
    cursor: pointer;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .action-buttons button:hover {
    opacity: 1;
  }

  /* Article Content & Themes */
  .reader-content {
    padding-bottom: 120px;
    transition:
      background-color 0.3s,
      color 0.3s;
  }

  /* Theme Definitions */
  .theme-light {
    --bg: #ffffff;
    --text: #1a1a1a;
    --meta: #666666;
    --divider: rgba(0, 0, 0, 0.1);
  }
  .theme-sepia {
    --bg: #f4ecd8;
    --text: #433422;
    --meta: #736357;
    --divider: rgba(67, 52, 34, 0.1);
  }
  .theme-dark {
    --bg: #2b313e;
    --text: #e2e8f0;
    --meta: #94a3b8;
    --divider: rgba(255, 255, 255, 0.1);
  }
  .theme-black {
    --bg: #000000;
    --text: #ffffff;
    --meta: #a1a1aa;
    --divider: rgba(255, 255, 255, 0.1);
  }

  :global(.reader-overlay:has(.theme-light)) {
    background: #ffffff;
    color: #1a1a1a;
  }
  :global(.reader-overlay:has(.theme-sepia)) {
    background: #f4ecd8;
    color: #433422;
  }
  :global(.reader-overlay:has(.theme-dark)) {
    background: #2b313e;
    color: #e2e8f0;
  }
  :global(.reader-overlay:has(.theme-black)) {
    background: #000000;
    color: #ffffff;
  }

  .reader-container {
    background: inherit;
    color: inherit;
  }

  /* Reader Overlay - Immediate Opacity */
  .reader-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(5, 5, 7, 0.98);
    z-index: 2000;
    display: flex;
    justify-content: center;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: fadeIn 0.2s ease-out;
  }

  /* Article Header */
  .article-header {
    margin-bottom: 40px;
  }

  .reader-title-new {
    font-size: 32px;
    font-weight: 800;
    line-height: 1.25;
    margin-bottom: 24px;
    letter-spacing: -0.02em;
    color: inherit;
  }

  .article-meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  }

  .article-date {
    font-size: 15px;
    opacity: 0.6;
    font-weight: 500;
  }

  .article-actions-mini {
    display: flex;
    gap: 20px;
  }

  .meta-action-btn {
    background: none;
    border: none;
    color: inherit;
    padding: 4px;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
  }

  .meta-action-btn:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .article-divider {
    height: 1px;
    background: var(--divider);
    width: 100%;
  }

  /* Typography */
  .reader-body {
    line-height: 1.8;
    letter-spacing: 0.01em;
    overflow-wrap: break-word;
    word-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
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
    border-left: 4px solid #a855f7;
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
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      monospace;
    font-size: 0.9em;
  }

  /* Font Sizes */
  .text-base {
    font-size: 18px;
  }
  .text-lg {
    font-size: 20px;
  }
  .text-xl {
    font-size: 23px;
  }
  .text-2xl {
    font-size: 27px;
  }

  /* Utilities */
  .reader-loading,
  .reader-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100px 20px;
    gap: 24px;
    opacity: 0.6;
  }

  .reader-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid rgba(128, 128, 128, 0.2);
    border-top-color: #a855f7;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes scaleIn {
    from {
      transform: scale(0.98);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .hidden {
    display: none;
  }
</style>
