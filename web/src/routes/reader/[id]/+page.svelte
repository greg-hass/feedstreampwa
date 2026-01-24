<script lang="ts">
  import { onDestroy, onMount, afterUpdate, tick } from "svelte";
  import { goto } from "$app/navigation";
  import type { PageData } from "./$types";
  import type { Discussion, ReaderData } from "$lib/types";
  import {
    readerSettings,
    type ReaderSettings,
  } from "$lib/stores/readerSettings";
  import ReadingProgress from "$lib/components/ReadingProgress.svelte";
  import * as itemsApi from "$lib/api/items";
  import { toast } from "$lib/stores/toast";
  import { confirmDialog } from "$lib/stores/confirm";
  import { playMedia } from "$lib/stores/media";
  import {
    saveReadingPosition,
    getReadingPosition,
    clearReadingPosition,
  } from "$lib/stores/reader";
  import { cacheArticleContent, getCachedContent, isOffline } from "$lib/stores/offlineArticles";

  // Sub-components
  import ReaderHeader from "$lib/components/reader/ReaderHeader.svelte";
  import YouTubePlayer from "$lib/components/reader/YouTubePlayer.svelte";
  import ArticleContent from "$lib/components/reader/ArticleContent.svelte";
  import DiscussionsPanel from "$lib/components/reader/DiscussionsPanel.svelte";

  export let data: PageData;

  $: item = data.item;

  let readerData: ReaderData | null = null;
  let readerLoading = false;
  let readerError: string | null = null;
  let summary: string | null = null;
  let summaryLoading = false;
  let showDiscussions = false;
  let discussions: Discussion[] = [];
  let discussionsLoading = false;
  let scrollContainer: HTMLElement | null = null;
  let ttsActive = false;
  let speechSynthesis: SpeechSynthesis | null = null;
  let currentUtterance: SpeechSynthesisUtterance | null = null;
  let savePositionTimer: ReturnType<typeof setTimeout> | null = null;
  let hasRestoredPosition = false;

  const readerCache = new Map<string, ReaderData>();

  // Save reading position on scroll (debounced)
  function handleScroll() {
    if (!scrollContainer || !item) return;

    const scrollHeight =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
    if (scrollHeight <= 0) return;

    const scrollPercent = scrollContainer.scrollTop / scrollHeight;

    // Debounce saving
    if (savePositionTimer) clearTimeout(savePositionTimer);
    savePositionTimer = setTimeout(() => {
      if (scrollPercent > 0.95) {
        // Article finished - clear position
        clearReadingPosition(item!.id);
      } else {
        saveReadingPosition(item!.id, scrollPercent);
      }
    }, 500);
  }

  // Restore reading position when article loads
  async function restoreReadingPosition() {
    if (!item || !scrollContainer || hasRestoredPosition) return;

    await tick(); // Wait for content to render

    const savedPercent = getReadingPosition(item.id);
    if (savedPercent && savedPercent > 0.05) {
      // Small delay to ensure content is fully rendered
      setTimeout(() => {
        if (!scrollContainer) return;
        const scrollHeight =
          scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (scrollHeight > 0) {
          scrollContainer.scrollTop = savedPercent * scrollHeight;
          hasRestoredPosition = true;
        }
      }, 100);
    }
  }

  async function loadReaderContent() {
    if (!item?.url) {
      console.error('No URL for item');
      return;
    }

    // For Reddit items, use the RSS content directly
    const isReddit = item.source === 'reddit' || (item.url && item.url.includes('reddit.com'));

    if (isReddit && (item.content || item.summary)) {
      const formattedData: ReaderData = {
        url: item.url,
        title: item.title,
        byline: item.author || null,
        excerpt: item.summary || null,
        siteName: 'Reddit',
        imageUrl: item.media_thumbnail || null,
        contentHtml: item.content || item.summary || '',
        fromCache: false
      };
      readerData = formattedData;
      readerCache.set(item.url, formattedData);
      readerLoading = false;
      return;
    }

    // Check in-memory cache first
    const cached = readerCache.get(item.url);
    if (cached) {
      readerData = cached;
      readerLoading = false;
      return;
    }

    // Check offline IndexedDB cache if offline OR if this is a starred article
    if ($isOffline || item.is_starred === 1) {
      try {
        const offlineContent = await getCachedContent(item.id);
        if (offlineContent) {
          const formattedData: ReaderData = {
            url: offlineContent.url,
            title: item.title || offlineContent.title,
            byline: offlineContent.byline,
            excerpt: offlineContent.excerpt,
            siteName: offlineContent.siteName,
            imageUrl: offlineContent.imageUrl,
            contentHtml: offlineContent.contentHtml,
            fromCache: true
          };
          readerData = formattedData;
          readerCache.set(item.url, formattedData);
          readerLoading = false;
          return;
        }
      } catch (e) {
        console.error('Failed to load from offline cache:', e);
      }
    }

    const isYouTube = item.source === 'youtube' || (item.url && (item.url.includes('youtube.com') || item.url.includes('youtu.be')));

    if (isYouTube) {
      // For YouTube, we don't need the scraper to show the video
      const formattedData: ReaderData = {
        url: item.url,
        title: item.title,
        byline: item.author || null,
        excerpt: item.summary || null,
        siteName: 'YouTube',
        imageUrl: item.media_thumbnail || null,
        contentHtml: '', // Will be handled by YouTubePlayer
        fromCache: false
      };
      readerData = formattedData;
      readerLoading = false;
    } else {
      readerLoading = true;
      readerData = null;
    }

    try {
      const data = await itemsApi.fetchReaderContent(item.url);

      // Check if we got valid content
      if (!data || !data.contentHtml) {
        if (isYouTube) return; // Silent failure for YouTube is fine
        throw new Error('No content returned from reader API');
      }

      // Map API response to ReaderData interface
      const formattedData: ReaderData = {
        url: data.url,
        title: item.title || data.title,
        byline: data.byline,
        excerpt: data.excerpt,
        siteName: data.siteName,
        imageUrl: data.imageUrl,
        contentHtml: data.contentHtml,
        fromCache: data.fromCache || false
      };

      readerData = formattedData;
      readerCache.set(item.url, formattedData);

      // Cache for offline if this is a starred article
      if (item.is_starred === 1) {
        cacheArticleContent(item.id, formattedData).catch(console.error);
      }
    } catch (err) {
      if (isYouTube) return; // YouTube already has basic data
      const errorMessage = err instanceof Error ? err.message : "Failed to load reader";
      console.error('Reader error:', errorMessage, 'for URL:', item.url);
      readerError = errorMessage;
    } finally {
      if (!isYouTube) readerLoading = false;
    }
  }

  async function handleSummarize() {
    if (!item) return;
    summaryLoading = true;
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (data.ok) summary = data.summary;
    } catch (e) {
      console.error(e);
    } finally {
      summaryLoading = false;
    }
  }

  async function fetchDiscussions() {
    if (!item?.url) return;
    discussionsLoading = true;
    try {
      const res = await fetch(
        `/api/discussions?url=${encodeURIComponent(item.url)}`,
      );
      const data = await res.json();
      if (data.ok) discussions = data.discussions;
    } catch (e) {
      console.error("Failed to fetch discussions", e);
    } finally {
      discussionsLoading = false;
    }
  }

  async function handleDelete() {
    if (!item) return;
    const confirmed = await confirmDialog.confirm({
      title: "Delete Article",
      message:
        "Are you sure you want to delete this article? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      await itemsApi.deleteItem(item.id);
      toast.success("Article deleted");
      goto("/");
    } catch (e) {
      toast.error("Failed to delete article");
    }
  }

  async function handleShare() {
    if (!item?.url && !readerData?.url) return;
    const shareUrl = readerData?.url || item?.url;
    if (!shareUrl) return;

    const shareData = {
      title: readerData?.title || item?.title || "Article from FeedStream",
      text: readerData?.excerpt || item?.summary || undefined,
      url: shareUrl,
    };

    try {
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare(shareData)
      ) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard!");
      }
    } catch (e) {
      console.error("Failed to share:", e);
    }
  }

  function toggleTTS() {
    if (!speechSynthesis) return;
    if (ttsActive) {
      speechSynthesis.cancel();
      ttsActive = false;
    } else {
      const text = (readerData?.contentHtml || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return;
      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.onend = () => {
        ttsActive = false;
      };
      currentUtterance.onerror = () => {
        ttsActive = false;
      };
      ttsActive = true;
      speechSynthesis.speak(currentUtterance);
    }
  }

  function handleClose() {
    if (speechSynthesis) speechSynthesis.cancel();
    goto("/");
  }

  function handlePlayMedia() {
    if (item) {
      playMedia(item);
    }
  }

  // Lifecycle & Watchers
  $: if (item?.id) {
    summary = null;
    summaryLoading = false;
    discussions = [];
    showDiscussions = false;
    hasRestoredPosition = false;
    fetchDiscussions();
    loadReaderContent();
  }

  // Restore position when content loads
  $: if (readerData && !readerLoading && scrollContainer) {
    restoreReadingPosition();
  }

  $: if (typeof window !== "undefined") {
    speechSynthesis = window.speechSynthesis;
  }

  onMount(() => {
    // Mark as read when opening
    if (item && item.is_read === 0) {
      itemsApi.toggleItemRead(item.id, true).catch(console.error);
    }

    return () => {
      if (savePositionTimer) clearTimeout(savePositionTimer);
    };
  });

  afterUpdate(() => {
    if (typeof document === "undefined") return;
    document.querySelectorAll("#reader-body-content img").forEach((img) => {
      if (img.getAttribute("data-error-handled")) return;
      img.addEventListener("error", (e) => {
        const target = e.target as HTMLElement;
        target.style.display = "none";
        if (target.parentElement?.tagName === "FIGURE")
          target.parentElement.style.display = "none";
      });
      img.setAttribute("data-error-handled", "true");
    });
  });

  // Style classes
  $: settingsValue = $readerSettings as ReaderSettings;
  $: fontSizeClass = (
    {
      small: "text-base",
      medium: "text-lg",
      large: "text-xl",
      xlarge: "text-2xl",
    } as Record<string, string>
  )[settingsValue.fontSize];
  $: fontFamilyClass = (
    {
      sans: "font-sans",
      serif: "font-serif",
      mono: "font-mono",
    } as Record<string, string>
  )[settingsValue.fontFamily];
  $: maxWidthClass = (
    {
      narrow: "max-w-2xl",
      medium: "max-w-3xl",
      wide: "max-w-4xl",
    } as Record<string, string>
  )[settingsValue.readingWidth];
  $: themeClass = `theme-${settingsValue.theme}`;
  $: displayUrl = readerData?.url || item?.url || "";
  $: isYouTube =
    displayUrl.includes("youtube.com") || displayUrl.includes("youtu.be");
</script>

<svelte:head>
  <title>{item?.title || 'Article'} - FeedStream</title>
</svelte:head>

<div class="reader-page {themeClass}">
  <div class="reader-container">
    <ReadingProgress {scrollContainer} />

    <ReaderHeader
      {handleClose}
      {handleDelete}
      {handleShare}
      {toggleTTS}
      {ttsActive}
    />

    <div
      class="reader-scroll-container"
      bind:this={scrollContainer}
      on:scroll={handleScroll}
    >
      {#if readerLoading && !(item?.source === "youtube" || (item?.url && (item.url.includes("youtube.com") || item.url.includes("youtu.be"))))}
        <div class="reader-loading">
          <div class="reader-spinner"></div>
          <span>Loading article...</span>
        </div>
      {:else if readerError}
        <div class="reader-error">
          <p>{readerError}</p>
          {#if item?.url}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              class="reader-fallback-btn">Open Original Article</a
            >
          {/if}
        </div>
      {:else if readerData || item}
        {#if isYouTube && displayUrl}
          <YouTubePlayer url={displayUrl} item={item} />
        {/if}

        {#if readerData}
          <ArticleContent
            {readerData}
            {item}
            {summary}
            {summaryLoading}
            {fontSizeClass}
            {fontFamilyClass}
            {maxWidthClass}
            {themeClass}
            onPlay={handlePlayMedia}
          />
        {/if}
      {/if}
    </div>
  </div>
</div>

<DiscussionsPanel
  {showDiscussions}
  {discussions}
  {discussionsLoading}
  toggleDiscussions={() => (showDiscussions = !showDiscussions)}
/>

<style>
  .reader-page {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    justify-content: center;
    background-color: var(--bg, #0c0c0e);
    color: var(--text, #e5e7eb);
  }

  .reader-container {
    width: 100%;
    max-width: 1100px;
    height: 100vh;
    padding-top: env(safe-area-inset-top, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    display: flex;
    flex-direction: column;
    background: transparent;
  }

  .reader-scroll-container {
    flex: 1;
    overflow-y: auto;
    padding: 28px 18px 80px;
    -webkit-overflow-scrolling: touch;
  }

  @media (min-width: 769px) {
    .reader-scroll-container {
      padding: 36px 48px 90px;
    }
  }

  /* Theme Definitions - Refined */
  .theme-light {
    --bg: #fafafa;
    --text: #1a1a1a;
    --divider: rgba(0, 0, 0, 0.08);
  }
  .theme-sepia {
    --bg: #f4ece0;
    --text: #433422;
    --divider: rgba(67, 52, 34, 0.08);
  }
  .theme-dark {
    --bg: #151518;
    --text: #e2e8f0;
    --divider: rgba(255, 255, 255, 0.08);
  }
  .theme-black {
    --bg: #0c0c0e;
    --text: #d4d4d8;
    --divider: rgba(255, 255, 255, 0.05);
  }

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
    border-top-color: var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .reader-fallback-btn {
    padding: 12px 24px;
    background: var(--accent-color);
    color: white;
    border-radius: 8px;
    font-weight: 600;
    text-decoration: none;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
