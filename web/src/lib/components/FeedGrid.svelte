<script lang="ts">
  import type { Item } from "$lib/types";
  import FeedListItem from "./FeedListItem.svelte";

  export let items: Item[] = [];

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
    <FeedListItem
      {item}
      feedType={guessType(item)}
      on:open
      on:toggleStar
      on:toggleRead
      on:play
    />
  {/each}
</div>
