<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { isAddFeedModalOpen, selectedFeedUrl } from "$lib/stores/ui";
  import { searchQuery } from "$lib/stores/items";

  onMount(() => {
    const title = $page.url.searchParams.get("title") || "";
    const text = $page.url.searchParams.get("text") || "";
    const url = $page.url.searchParams.get("url") || "";

    // Some Android shares put the URL in 'text'
    let target = url;
    if (!target && text) {
      // Extract URL from text if present
      const match = text.match(/(https?:\/\/[^\s]+)/);
      if (match) target = match[0];
    }

    if (target) {
      selectedFeedUrl.set(target);
      // Also populate search query specifically for the Add Feed logic which often uses it
      // But AddFeedModal might use selectedFeedUrl if provided.
      // We'll set the store which AddFeedModal watches or uses.
      isAddFeedModalOpen.set(true);
    }

    // Redirect to home
    goto("/", { replaceState: true });
  });
</script>

<div class="flex items-center justify-center h-screen bg-[#18181b] text-white">
  <div class="flex flex-col items-center gap-4">
    <div
      class="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"
    ></div>
    <p class="text-sm text-white/50">Processing shared URL...</p>
  </div>
</div>
