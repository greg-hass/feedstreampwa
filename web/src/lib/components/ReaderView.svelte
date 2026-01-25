<script lang="ts">
  import { onDestroy, onMount, afterUpdate, tick } from "svelte";
  import type { Discussion, ReaderData } from "$lib/types";
  import {
    showReader,
    readerData,
    readerLoading,
    readerError,
    currentItem,
    closeReader,
    saveReadingPosition,
    getReadingPosition,
    clearReadingPosition,
  } from "$lib/stores/reader";
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
    cacheArticleContent,
    getCachedContent,
    isOffline,
  } from "$lib/stores/offlineArticles";

  // Sub-components
  import ReaderHeader from "./reader/ReaderHeader.svelte";
  import YouTubePlayer from "./reader/YouTubePlayer.svelte";
  import ArticleContent from "./reader/ArticleContent.svelte";
  import DiscussionsPanel from "./reader/DiscussionsPanel.svelte";

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
    if (!scrollContainer || !$currentItem) return;

    const scrollHeight =
      scrollContainer.scrollHeight - scrollContainer.clientHeight;
    if (scrollHeight <= 0) return;

    const scrollPercent = scrollContainer.scrollTop / scrollHeight;

    // Debounce saving
    if (savePositionTimer) clearTimeout(savePositionTimer);
    savePositionTimer = setTimeout(() => {
      if (scrollPercent > 0.95) {
        // Article finished - clear position
        clearReadingPosition($currentItem!.id);
      } else {
        saveReadingPosition($currentItem!.id, scrollPercent);
      }
    }, 500);
  }

  // Restore reading position when article loads
  async function restoreReadingPosition() {
    if (!$currentItem || !scrollContainer || hasRestoredPosition) return;

    await tick(); // Wait for content to render

    const savedPercent = getReadingPosition($currentItem.id);
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
    if (!$currentItem?.url) {
      console.error("No URL for item");
      return;
    }

    const item = $currentItem;

    // For Reddit items, use the RSS content directly
    const isReddit =
      item.source === "reddit" || (item.url && item.url.includes("reddit.com"));

    if (isReddit && (item.content || item.summary)) {
      const formattedData: ReaderData = {
        url: item.url!,
        title: item.title!,
        byline: item.author || null,
        excerpt: item.summary || null,
        siteName: "Reddit",
        imageUrl: item.media_thumbnail || null,
        contentHtml: item.content || item.summary || "",
        fromCache: false,
      };
      readerData.set(formattedData);
      readerLoading.set(false);
      return;
    }

    // Check in-memory cache first
    const cached = readerCache.get(item.url!);
    if (cached) {
      readerData.set(cached);
      readerLoading.set(false);
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
            fromCache: true,
          };
          readerData.set(formattedData);
          readerCache.set(item.url!, formattedData);
          readerLoading.set(false);
          return;
        }
      } catch (e) {
        console.error("Failed to load from offline cache:", e);
      }
    }

    const isYouTube =
      item.source === "youtube" ||
      (item.url &&
        (item.url.includes("youtube.com") || item.url.includes("youtu.be")));

    if (isYouTube) {
      // For YouTube, we don't need the scraper to show the video
      const formattedData: ReaderData = {
        url: item.url!,
        title: item.title!,
        byline: item.author || null,
        excerpt: item.summary || null,
        siteName: "YouTube",
        imageUrl: item.media_thumbnail || null,
        contentHtml: "", // Will be handled by YouTubePlayer
        fromCache: false,
      };
      readerData.set(formattedData);
      readerLoading.set(false);
    } else {
      readerLoading.set(true);
      readerData.set(null);
    }

    try {
      const data = await itemsApi.fetchReaderContent(item.url!);

      // Check if we got valid content
      if (!data || !data.contentHtml) {
        if (isYouTube) return; // Silent failure for YouTube is fine
        throw new Error("No content returned from reader API");
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
        fromCache: data.fromCache || false,
      };

      readerData.set(formattedData);
      readerCache.set(item.url!, formattedData);

      // Cache for offline if this is a starred article
      if (item.is_starred === 1) {
        cacheArticleContent(item.id, formattedData).catch(console.error);
      }
    } catch (err) {
      if (isYouTube) return; // YouTube already has basic data
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load reader";
      console.error("Reader error:", errorMessage, "for URL:", item.url);
      readerError.set(errorMessage);
    } finally {
      if (!isYouTube) readerLoading.set(false);
    }
  }

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
      if (data.ok) summary = data.summary;
    } catch (e) {
      console.error(e);
    } finally {
      summaryLoading = false;
    }
  }

  async function fetchDiscussions() {
    if (!$currentItem?.url) return;
    discussionsLoading = true;
    try {
      const res = await fetch(
        `/api/discussions?url=${encodeURIComponent($currentItem.url)}`,
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
    if (!$currentItem) return;
    const confirmed = await confirmDialog.confirm({
      title: "Delete Article",
      message:
        "Are you sure you want to delete this article? This action cannot be undone.",
      confirmText: "Delete",
      type: "danger",
    });

    if (!confirmed) return;

    try {
      await itemsApi.deleteItem($currentItem.id);
      toast.success("Article deleted");
      handleClose();
      if (typeof window !== "undefined") window.location.reload();
    } catch (e) {
      toast.error("Failed to delete article");
    }
  }

  async function handleShare() {
    if (!$currentItem && !$readerData?.url) return;
    const shareUrl = $readerData?.url || $currentItem?.url;
    if (!shareUrl) return;

    const shareData = {
      title:
        $readerData?.title || $currentItem?.title || "Article from FeedStream",
      text: $readerData?.excerpt || $currentItem?.summary || undefined,
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
      const text = ($readerData?.contentHtml || "")
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
    closeReader();
  }

  function handlePlayMedia() {
    if ($currentItem) {
      playMedia($currentItem);
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.currentTarget === e.target) {
      handleClose();
    }
  }

  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClose();
    }
  }

  // Lifecycle & Watchers
  $: if ($currentItem?.id) {
    summary = null;
    summaryLoading = false;
    discussions = [];
    showDiscussions = false;
    hasRestoredPosition = false; // Reset for new article
    fetchDiscussions();
    loadReaderContent();
  }

  // Restore position when content loads
  $: if ($readerData && !$readerLoading && scrollContainer) {
    restoreReadingPosition();
  }

  $: if (typeof window !== "undefined") {
    speechSynthesis = window.speechSynthesis;
  }

  $: if (typeof document !== "undefined") {
    document.body.style.overflow = $showReader ? "hidden" : "";
  }

  onMount(() => {
    return () => {
      if (typeof document !== "undefined") document.body.style.overflow = "";
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
  $: displayUrl = $readerData?.url || $currentItem?.url || "";
  $: isYouTube =
    displayUrl.includes("youtube.com") || displayUrl.includes("youtu.be");

  export let isEmbedded = false;
</script>

{#if $showReader || isEmbedded}
  <div
    class="reader-overlay {themeClass}"
    class:reader-embedded={isEmbedded}
    on:click={!isEmbedded ? handleOverlayClick : undefined}
    on:keydown={!isEmbedded ? handleOverlayKeydown : undefined}
    role="presentation"
  >
    <div
      class="reader-container"
      role="dialog"
      aria-modal={!isEmbedded}
      aria-labelledby="reader-title"
      tabindex="-1"
    >
      <ReadingProgress {scrollContainer} />

      <ReaderHeader
        {handleClose}
        {handleShare}
        {toggleTTS}
        {ttsActive}
        {isEmbedded}
      />

      <div
        class="reader-scroll-container"
        bind:this={scrollContainer}
        on:scroll={handleScroll}
      >
        {#if $readerLoading && !($currentItem?.source === "youtube" || ($currentItem?.url && ($currentItem.url.includes("youtube.com") || $currentItem.url.includes("youtu.be"))))}
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
                class="reader-fallback-btn">Open Original Article</a
              >
            {/if}
          </div>
        {:else if $readerData || $currentItem}
          {#if isYouTube && displayUrl}
            <YouTubePlayer url={displayUrl} item={$currentItem} />
          {/if}

          {#if $readerData}
            <ArticleContent
              readerData={$readerData}
              item={$currentItem}
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
{/if}

<DiscussionsPanel
  {showDiscussions}
  {discussions}
  {discussionsLoading}
  toggleDiscussions={() => (showDiscussions = !showDiscussions)}
/>

<style>
  .reader-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    display: flex;
    justify-content: center;
    background-color: var(--bg, #000000);
    color: var(--text, #e5e7eb);
    animation: fadeIn 0.2s ease-out;
  }

  .reader-overlay.reader-embedded {
    position: relative;
    z-index: 10;
    background: var(--bg, #000000);
    animation: none;
    height: 100vh;
    border-left: 1px solid theme("colors.stroke");
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
    animation: fadeIn 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  }

  .reader-embedded .reader-container {
    max-width: none;
    animation: none;
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
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
