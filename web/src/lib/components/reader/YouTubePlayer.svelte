<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import type { Item } from "$lib/types";

  export let url: string;
  export let item: Item | null;

  let ytPlayer: any = null;
  let ytProgressInterval: ReturnType<typeof setInterval> | null = null;
  let ytInitTimeout: ReturnType<typeof setTimeout> | null = null;
  let isDestroyed = false;

  function initYouTubePlayer() {
    if (!(window as any).YT) {
      loadYouTubeAPI();
      return;
    }

    let videoId = null;
    if (url.includes("v=")) {
      videoId = url.split("v=")[1]?.split("&")[0];
    } else if (url.includes("youtu.be/")) {
      videoId = url.split("youtu.be/")[1]?.split("?")[0];
    } else if (item?.external_id) {
      videoId = item.external_id;
    }

    if (!videoId) return;

    if (ytInitTimeout) clearTimeout(ytInitTimeout);
    ytInitTimeout = setTimeout(() => {
      const container = document.getElementById("yt-player-container");
      if (!container) return;

      if (ytPlayer) {
        try { ytPlayer.destroy(); } catch (e) {}
      }

      const startPos = Math.floor(item?.playback_position || 0);

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
          onStateChange: (event: any) => {
            if (event.data === (window as any).YT.PlayerState.PLAYING) {
              startProgressSync();
            } else {
              stopProgressSync();
              syncPlaybackPosition();
            }
          },
        },
      });
    }, 100);
  }

  function loadYouTubeAPI() {
    if ((window as any).YT) {
      initYouTubePlayer();
      return;
    }

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      if (isDestroyed) return;
      initYouTubePlayer();
    };
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
    if (!ytPlayer || !ytPlayer.getCurrentTime || !item) return;
    const currentTime = ytPlayer.getCurrentTime();
    try {
      await fetch(`/api/items/${item.id}/playback-position`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: currentTime }),
      });
    } catch (e) {
      console.error("Failed to sync playback position:", e);
    }
  }

  onMount(() => {
    initYouTubePlayer();
  });

  onDestroy(() => {
    isDestroyed = true;
    stopProgressSync();
    if (ytInitTimeout) clearTimeout(ytInitTimeout);
    if (ytPlayer) {
      try { ytPlayer.destroy(); } catch (e) {}
    }
  });
</script>

<div
  class="video-wrapper"
  style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; margin-bottom: 24px; background: #000;"
>
  <div
    id="yt-player-container"
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
  ></div>
</div>
