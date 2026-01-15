<script lang="ts">
  import { onDestroy, onMount, afterUpdate } from "svelte";
  import {
    showReader,
    readerData,
    readerLoading,
    readerError,
    currentItem,
    closeReader,
  } from "$lib/stores/reader";
  import { readerSettings } from "$lib/stores/readerSettings";
  import ReadingProgress from "$lib/components/ReadingProgress.svelte";
  import * as itemsApi from "$lib/api/items";
  import { toast } from "$lib/stores/toast";
  import { confirmDialog } from "$lib/stores/confirm";

  // Sub-components
  import ReaderHeader from "./reader/ReaderHeader.svelte";
  import YouTubePlayer from "./reader/YouTubePlayer.svelte";
  import ArticleContent from "./reader/ArticleContent.svelte";
  import DiscussionsPanel from "./reader/DiscussionsPanel.svelte";

  let summary: string | null = null;
  let summaryLoading = false;
  let showDiscussions = false;
  let discussions: any[] = [];
  let discussionsLoading = false;
  let scrollContainer: HTMLElement | null = null;
  let ttsActive = false;
  let speechSynthesis: SpeechSynthesis | null = null;
  let currentUtterance: SpeechSynthesisUtterance | null = null;

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
      const res = await fetch(`/api/discussions?url=${encodeURIComponent($currentItem.url)}`);
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
      message: "Are you sure you want to delete this article? This action cannot be undone.",
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
      title: $readerData?.title || $currentItem?.title || "Article from FeedStream",
      text: $readerData?.excerpt || $currentItem?.summary || undefined,
      url: shareUrl,
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
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
      const text = ($readerData?.contentHtml || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      if (!text) return;
      currentUtterance = new SpeechSynthesisUtterance(text);
      currentUtterance.onend = () => { ttsActive = false; };
      currentUtterance.onerror = () => { ttsActive = false; };
      ttsActive = true;
      speechSynthesis.speak(currentUtterance);
    }
  }

  function handleClose() {
    if (speechSynthesis) speechSynthesis.cancel();
    closeReader();
  }

  // Lifecycle & Watchers
  $: if ($currentItem?.id) {
    summary = null;
    summaryLoading = false;
    discussions = [];
    showDiscussions = false;
    fetchDiscussions();
  }

  $: if (typeof window !== "undefined") {
    speechSynthesis = window.speechSynthesis;
  }

  $: if (typeof document !== "undefined") {
    document.body.style.overflow = $showReader ? "hidden" : "";
  }

  onMount(() => {
    return () => { if (typeof document !== "undefined") document.body.style.overflow = ""; };
  });

  afterUpdate(() => {
    if (typeof document === "undefined") return;
    document.querySelectorAll("#reader-body-content img").forEach((img) => {
      if (img.getAttribute("data-error-handled")) return;
      img.addEventListener("error", (e) => {
        const target = e.target as HTMLElement;
        target.style.display = "none";
        if (target.parentElement?.tagName === "FIGURE") target.parentElement.style.display = "none";
      });
      img.setAttribute("data-error-handled", "true");
    });
  });

  // Style classes
  $: fontSizeClass = { small: "text-base", medium: "text-lg", large: "text-xl", xlarge: "text-2xl" }[$readerSettings.fontSize];
  $: fontFamilyClass = { sans: "font-sans", serif: "font-serif", mono: "font-mono" }[$readerSettings.fontFamily];
  $: maxWidthClass = { narrow: "max-w-2xl", medium: "max-w-3xl", wide: "max-w-4xl" }[$readerSettings.readingWidth];
  $: themeClass = `theme-${$readerSettings.theme}`;
</script>

{#if $showReader}
  <div
    class="reader-overlay {themeClass}"
    on:click={handleClose}
    on:keydown={(e) => (e.key === "Enter" || e.key === " ") && handleClose()}
    role="button"
    tabindex="0"
  >
    <div class="reader-container" on:click|stopPropagation role="dialog" aria-modal="true">
      <ReadingProgress {scrollContainer} />

      <ReaderHeader 
        {handleClose} 
        {handleDelete} 
        {handleShare} 
        {toggleTTS} 
        {ttsActive} 
      />

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
              <a href={$currentItem.url} target="_blank" rel="noopener noreferrer" class="reader-fallback-btn">Open Original Article</a>
            {/if}
          </div>
        {:else if $readerData}
          {#if $readerData.url && ($readerData.url.includes("youtube.com/watch") || $readerData.url.includes("youtu.be/"))}
            <YouTubePlayer url={$readerData.url} item={$currentItem} />
          {/if}

          <ArticleContent 
            readerData={$readerData} 
            item={$currentItem} 
            {summary} 
            {summaryLoading} 
            {fontSizeClass} 
            {fontFamilyClass} 
            {maxWidthClass} 
            {themeClass} 
          />
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
    background-color: var(--bg, #121212);
    color: var(--text, #e5e7eb);
    backdrop-filter: blur(10px);
    animation: fadeIn 0.2s ease-out;
  }

  .reader-container {
    width: 100%;
    max-width: 720px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: inherit;
    animation: scaleIn 0.25s ease-out;
  }

  .reader-scroll-container {
    flex: 1;
    overflow-y: auto;
    padding: 24px 16px;
    -webkit-overflow-scrolling: touch;
  }

  @media (min-width: 769px) {
    .reader-scroll-container { padding: 32px 40px; }
  }

  /* Theme Definitions */
  .theme-light { --bg: #ffffff; --text: #1a1a1a; --divider: rgba(0, 0, 0, 0.1); }
  .theme-sepia { --bg: #f4ecd8; --text: #433422; --divider: rgba(67, 52, 34, 0.1); }
  .theme-dark { --bg: #2b313e; --text: #e2e8f0; --divider: rgba(255, 255, 255, 0.1); }
  .theme-black { --bg: #000000; --text: #ffffff; --divider: rgba(255, 255, 255, 0.1); }

  .reader-loading, .reader-error {
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px 20px; gap: 24px; opacity: 0.6;
  }

  .reader-spinner {
    width: 32px; height: 32px; border: 3px solid rgba(128, 128, 128, 0.2); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite;
  }

  .reader-fallback-btn {
    padding: 12px 24px; background: var(--accent-color); color: white; border-radius: 8px; font-weight: 600; text-decoration: none;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleIn { from { transform: scale(0.98); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>