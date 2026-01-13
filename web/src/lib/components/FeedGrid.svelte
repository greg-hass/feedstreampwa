<script lang="ts">
  import type { Item } from "$lib/types";
  import type { ViewDensity } from "$lib/stores/ui";
  import FeedListItem from "./FeedListItem.svelte";
  import SwipeableItem from "./SwipeableItem.svelte";
  import { createEventDispatcher } from "svelte";

  export let items: Item[] = [];
  export let density: ViewDensity = "comfortable";

  const dispatch = createEventDispatcher();

  // Simple helper to visualize the "Premium" accents based on available data
  function guessType(item: Item): "rss" | "youtube" | "reddit" | "podcast" {
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
    <SwipeableItem
      on:markRead={() => dispatch("toggleRead", { item })}
      on:toggleBookmark={() => dispatch("toggleStar", { item })}
    >
      <FeedListItem
        {item}
        {density}
        feedType={guessType(item)}
        on:open
        on:toggleStar
        on:toggleRead
        on:play
      />
    </SwipeableItem>
  {/each}
</div>
