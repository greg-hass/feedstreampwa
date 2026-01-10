<script lang="ts">
  import { Bookmark } from "lucide-svelte";
  import type { Item } from "$lib/types";

  export let item: Item;
  export let onOpen: (item: Item) => void;
  export let onToggleStar: (item: Item) => void;
  export let onToggleRead: (item: Item) => void;

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "Unknown";
    try {
      const date = new Date(dateStr);
      return (
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    } catch {
      return dateStr;
    }
  }

  function handleArticleClick(event: MouseEvent) {
    // Don't open reader if clicking on a link or button
    const target = event.target as HTMLElement;
    if (
      target.tagName === "A" ||
      target.tagName === "BUTTON" ||
      target.closest("a") ||
      target.closest("button")
    ) {
      return;
    }

    onOpen(item);
  }
</script>

<article
  class="article-card"
  class:unread={Boolean(!item.is_read)}
  on:click={handleArticleClick}
  role="button"
  tabindex="0"
>
  <div class="card-content-wrapper">
    <!-- Top Metadata Row -->
    <div class="article-meta-top">
      <div class="feed-info">
        {#if item.feed_icon_url}
          <img
            src={item.feed_icon_url}
            alt=""
            class="feed-favicon"
            on:error={(e) => {
              const target = e.target;
              if (target instanceof HTMLImageElement)
                target.style.display = "none";
            }}
          />
        {/if}
        <span class="feed-title-meta"
          >{item.feed_title || "Feed"}</span
        >
        {#if item.published}
          <span class="meta-sep">•</span>
          <span class="publish-time"
            >{formatDate(item.published)}</span
          >
        {/if}
      </div>
      
      <div class="article-actions-floating">
        <button
          class="action-icon-btn"
          class:active={item.is_starred === 1}
          on:click|stopPropagation={() => onToggleStar(item)}
          title={item.is_starred === 1
            ? "Remove bookmark"
            : "Bookmark"}
        >
          <Bookmark
            size={18}
            fill={item.is_starred === 1 ? "currentColor" : "none"}
          />
        </button>
        <button
          class="action-icon-btn"
          class:read={item.is_read === 1}
          on:click|stopPropagation={() => onToggleRead(item)}
          title={item.is_read === 1
            ? "Mark as unread"
            : "Mark as read"}
        >
          <div class="read-indicator-dot"></div>
        </button>
      </div>
    </div>
    
    <!-- Title Row -->
    <h3 class="article-title-premium">
      {item.title || "Untitled"}
    </h3>
    
    <!-- Content Body -->
    <div class="article-body-layout">
      <div class="article-text-col">
        {#if item.summary}
          <p class="article-summary-premium">
            {item.summary}
          </p>
        {/if}
      </div>
      
      {#if item.media_thumbnail}
        <div class="article-thumbnail-premium">
          <img
            src={item.media_thumbnail}
            alt={item.title || "Thumbnail"}
            loading="lazy"
          />
        </div>
      {/if}
    </div>
  </div>
</article>

<style>
  .article-card {
    position: relative;
    border-bottom: 1px solid var(--stroke);
    background: transparent;
    transition: background 0.2s;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 120px;
    padding: 24px var(--page-padding);
  }

  .article-card:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .article-card:last-child {
    border-bottom: none;
  }

  .card-content-wrapper {
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* Top Meta Row */
  .article-meta-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-ui);
    font-size: 12px;
    color: var(--muted2);
    gap: 8px;
  }

  .feed-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .feed-favicon {
    width: 16px;
    height: 16px;
    object-fit: contain;
    border-radius: 4px;
  }

  .feed-title-meta {
    color: var(--accent);
    font-weight: 600;
    letter-spacing: 0;
    font-size: 12px;
  }

  .publish-time {
    color: var(--muted2);
    font-weight: 400;
  }

  .meta-sep {
    color: var(--muted2);
  }

  /* Floating Actions (Top Right) */
  .article-actions-floating {
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .article-card:hover .article-actions-floating {
    opacity: 1;
  }

  .action-icon-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--muted);
    padding: 4px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .action-icon-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text);
  }

  .action-icon-btn.active {
    color: #ffb02e;
  }

  .read-indicator-dot {
    width: 7px;
    height: 7px;
    background: var(--accent);
    border-radius: 50%;
    box-shadow: 0 0 6px var(--accent-glow);
  }

  .action-icon-btn.read .read-indicator-dot {
    background: var(--stroke-strong);
    box-shadow: none;
    opacity: 0.3;
    width: 6px;
    height: 6px;
  }

  /* Title */
  .article-title-premium {
    font-family: var(--font-display);
    font-size: 20px;
    line-height: 1.35;
    font-weight: 600;
    color: var(--text);
    letter-spacing: -0.01em;
    margin: 0;
    transition: color 0.2s;
  }

  /* Unread State Highlight */
  .article-card.unread .article-title-premium {
    color: #fff;
    font-weight: 700;
  }

  /* Body Layout (Text Left, Image Right) */
  .article-body-layout {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .article-text-col {
    flex: 1;
  }

  .article-summary-premium {
    font-size: 14px;
    line-height: 1.6;
    color: var(--muted);
    margin: 0;
    font-weight: 400;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .article-thumbnail-premium {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
    background: var(--bg2);
    border: 1px solid var(--stroke);
  }

  .article-thumbnail-premium img {
    width: 100%;
    height: auto;
    display: block;
    object-fit: cover;
  }

  /* Desktop Adjustments */
  @media (min-width: 768px) {
    .article-body-layout {
      flex-direction: row;
      align-items: flex-start;
    }

    .article-thumbnail-premium {
      width: 160px;
      height: 100px;
    }

    .article-thumbnail-premium img {
      width: 100%;
      height: 100%;
    }
  }
</style>
