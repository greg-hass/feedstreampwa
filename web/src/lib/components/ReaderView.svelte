<script lang="ts">
  import { showReader, readerData, readerLoading, readerError, currentItem, closeReader } from "$lib/stores/reader";

  let ytPlayer: any = null;
  let ytProgressInterval: ReturnType<typeof setInterval> | null = null;
  let ytApiLoaded = false;

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
      <div class="reader-header">
        <button
          class="reader-close"
          on:click={handleClose}
          title="Close (ESC)"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M5 5l10 10M15 5l-10 10"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              />
          </svg>
        </button>
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
          {:else if $readerData.imageUrl}
            <img src={$readerData.imageUrl} alt="" class="reader-hero" />
          {/if}
          <h1 class="reader-title" id="reader-title">
            {$readerData.title || "Untitled"}
          </h1>
          {#if $readerData.byline || $readerData.siteName}
            <div class="reader-meta">
              {#if $readerData.byline}<span>{$readerData.byline}</span>{/if}
              {#if $readerData.byline && $readerData.siteName}<span
                  class="meta-sep">•</span
                >{/if}
              {#if $readerData.siteName}<span>{$readerData.siteName}</span>{/if}
            </div>
          {/if}
          <div class="reader-body" id="reader-body-content">
            {#if !($readerData.url && ($readerData.url.includes("youtube.com/watch") || $readerData.url.includes("youtu.be/")))}
              {@html $readerData.contentHtml}
            {/if}
          </div>
        </article>
      {/if}
    </div>
  </div>
{/if}

<style>
  .reader-overlay {
    position: fixed;
    inset: 0;
    background: #050507;
    z-index: 2000;
    display: flex;
    justify-content: center;
    overflow-y: auto;
    overflow-x: hidden;
    animation: fadeIn 0.2s ease;
  }

  .reader-container {
    width: 100%;
    max-width: 720px;
    min-height: 100vh;
    padding: 24px 16px;
    animation: scaleIn 0.25s ease-out;
    overflow-x: hidden;
  }

  @media (min-width: 769px) {
    .reader-container {
      padding: 24px 32px;
    }
  }

  .reader-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
    position: sticky;
    top: 0;
    background: #050507;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding: 16px 0;
    z-index: 10;
  }

  .reader-close {
    width: 44px;
    height: 44px;
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
    font-size: 14px;
    font-weight: 500;
    padding: 10px 16px;
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
  }

  .reader-hero {
    width: 100%;
    max-height: 400px;
    object-fit: cover;
    border-radius: var(--radiusM);
    margin-bottom: 32px;
  }

  .reader-title {
    font-family: var(--font-display);
    font-size: 32px;
    font-weight: 700;
    line-height: 1.25;
    letter-spacing: -0.02em;
    margin: 0 0 16px 0;
    color: #fff;
  }

  .reader-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 15px;
    color: var(--muted);
    margin-bottom: 32px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--stroke);
  }

  .meta-sep {
    color: var(--muted);
  }

  .reader-body {
    font-size: 18px;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.88);
  }

  .reader-body p {
    margin: 0 0 1.5em 0;
  }

  .reader-body a {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .reader-body a:hover {
    text-decoration: none;
  }

  .reader-body blockquote {
    margin: 1.5em 0;
    padding-left: 20px;
    border-left: 3px solid var(--accent);
    color: var(--muted);
    font-style: italic;
  }

  .reader-body pre,
  .reader-body code {
    background: var(--panel0);
    border-radius: 6px;
    font-family: "SF Mono", "Monaco", "Consolas", monospace;
    font-size: 0.9em;
  }

  .reader-body pre {
    padding: 16px;
    overflow-x: auto;
    margin: 1.5em 0;
  }

  .reader-body code {
    padding: 2px 6px;
  }

  .reader-body ul,
  .reader-body ol {
    margin: 1.5em 0;
    padding-left: 1.5em;
  }

  .reader-body li {
    margin-bottom: 0.5em;
  }

  .reader-body h2,
  .reader-body h3 {
    font-family: var(--font-display);
    margin: 2em 0 1em 0;
    color: #fff;
  }

  .reader-body h2 {
    font-size: 24px;
  }

  .reader-body h3 {
    font-size: 20px;
  }

  .reader-body hr {
    border: none;
    border-top: 1px solid var(--stroke);
    margin: 2em 0;
  }
</style>
