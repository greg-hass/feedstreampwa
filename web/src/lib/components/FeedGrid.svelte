<script lang="ts">
  import type { Item } from "$lib/types";
  import FeedCard from "./FeedCard.svelte";

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

<!-- 
   Responsive Grid Strategy:
   Mobile: 1 column
   Tablet: 2 columns
   Desktop: 3 columns
   Large: 4 columns
-->
<div
  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 w-full pb-32"
>
  {#each items as item (item.id)}
    <FeedCard
      {item}
      feedType={guessType(item)}
      on:open
      on:toggleStar
      on:toggleRead
    />
  {/each}
</div>
