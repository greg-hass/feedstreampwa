<script lang="ts">
  import type { Item } from "$lib/types";
  import type { ViewDensity } from "$lib/stores/ui";
  import FeedListItem from "./FeedListItem.svelte";
  import SwipeableItem from "./SwipeableItem.svelte";
  import { createEventDispatcher } from "svelte";
  import { now } from "$lib/stores/clock";
  import { computeTimeAgo } from "$lib/utils/timeAgo";

  export let items: Item[] = [];
  export let density: ViewDensity = "comfortable";
  export let liveInsertIds: Set<string> = new Set();

  const dispatch = createEventDispatcher();

  // Compute timeAgo for all items at once when $now updates (single subscription)
  $: timeAgoMap = new Map(
    items.map((item) => [
      item.id,
      computeTimeAgo(item.published || item.created_at, $now),
    ]),
  );

  // Simple helper to visualize the "Premium" accents based on available data
  function guessType(item: Item): "rss" | "youtube" | "reddit" | "podcast" {
    const source = (item.source || "").toLowerCase();
    if (source === "youtube" || source === "reddit" || source === "podcast") {
      return source;
    }

    const t = (item.feed_title || "").toLowerCase();
    const u = (item.url || "").toLowerCase();

    if (t.includes("youtube") || u.includes("youtube.com")) return "youtube";
    if (t.includes("reddit") || u.includes("reddit.com")) return "reddit";
    if (t.includes("podcast") || u.includes("pod")) return "podcast";
    return "rss";
  }
</script>

<!-- List View - Single column, full width -->
<div class="flex flex-col gap-0 w-full">
  {#each items as item (item.id)}
    <div
      class="feed-item-wrapper"
      class:live-insert={liveInsertIds.has(item.id)}
    >
      <FeedListItem
        {item}
        {density}
        feedType={guessType(item)}
        timeAgo={timeAgoMap.get(item.id) || ""}
        on:open
        on:toggleStar
        on:toggleRead
        on:play
      />
    </div>
  {/each}
</div>

<style>
  /* Content-visibility optimization removed to prevent flickering */
  .feed-item-wrapper {
    /* Removed contain-intrinsic-size to prevent jumping in spacious mode */
  }

  .live-insert {
    animation: liveInsert 360ms ease-out;
  }

  @keyframes liveInsert {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .live-insert {
      animation: none;
    }
  }
</style>
