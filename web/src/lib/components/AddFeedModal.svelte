<script lang="ts">
  import { X, PlusCircle, Rss, Loader2, CheckCircle2 } from "lucide-svelte";
  import { isAddFeedModalOpen } from "$lib/stores/ui";
  import { createFeed } from "$lib/api/feeds";

  let feedUrl = "";
  let adding = false;
  let error: string | null = null;
  let successMessage = false;

  function closeModal() {
    isAddFeedModalOpen.set(false);
    feedUrl = "";
    error = null;
    successMessage = false;
  }

  async function handleAddFeed() {
    if (!feedUrl.trim()) {
      error = "Please enter a feed URL";
      return;
    }

    adding = true;
    error = null;
    successMessage = false;

    try {
      await createFeed(feedUrl.trim());
      successMessage = true;

      // Close modal after short delay
      setTimeout(() => {
        closeModal();
        // Reload the page to show the new feed
        window.location.reload();
      }, 1000);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to add feed";
    } finally {
      adding = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "Enter" && !adding) {
      handleAddFeed();
    }
  }

  // Example feed URLs for user guidance
  const exampleFeeds = [
    { label: "RSS Blog", url: "https://example.com/feed.xml" },
    { label: "YouTube Channel", url: "https://www.youtube.com/feeds/videos.xml?channel_id=..." },
    { label: "Podcast", url: "https://feeds.example.com/podcast.xml" },
  ];
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $isAddFeedModalOpen}
  <!-- Modal Backdrop -->
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    on:click={closeModal}
    on:keydown={(e) => e.key === "Enter" && closeModal()}
    role="button"
    tabindex="-1"
  >
    <!-- Modal Content -->
    <div
      class="glass rounded-2xl border border-white/10 max-w-lg w-full"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="bg-black/40 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/20 flex items-center justify-center"
          >
            <Rss size={20} class="text-emerald-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white">Add New Feed</h2>
            <p class="text-sm text-white/60">
              Subscribe to RSS feeds, podcasts, or YouTube channels
            </p>
          </div>
        </div>
        <button
          class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          on:click={closeModal}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 space-y-4">
        <!-- URL Input -->
        <div class="space-y-2">
          <label for="feed-url" class="block text-sm font-semibold text-white">
            Feed URL
          </label>
          <input
            id="feed-url"
            type="url"
            placeholder="https://example.com/feed.xml"
            bind:value={feedUrl}
            disabled={adding}
            class="w-full bg-white/5 px-4 py-3 rounded-xl text-white placeholder-white/40 border border-white/10 hover:bg-white/10 focus:border-accent/50 transition-colors outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            autofocus
          />
          <p class="text-xs text-white/40">
            Paste the URL of an RSS feed, podcast feed, or YouTube channel
          </p>
        </div>

        <!-- Examples -->
        <div class="space-y-2">
          <p class="text-xs font-semibold text-white/60 uppercase tracking-wider">
            Examples
          </p>
          <div class="space-y-1">
            {#each exampleFeeds as example}
              <button
                class="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 hover:text-white transition-colors"
                on:click={() => (feedUrl = example.url)}
                disabled={adding}
              >
                <span class="font-medium">{example.label}:</span>
                <span class="ml-2 opacity-60">{example.url}</span>
              </button>
            {/each}
          </div>
        </div>

        <!-- Error Message -->
        {#if error}
          <div
            class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            {error}
          </div>
        {/if}

        <!-- Success Message -->
        {#if successMessage}
          <div
            class="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2"
          >
            <CheckCircle2 size={16} />
            Feed added successfully!
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div
        class="bg-black/40 backdrop-blur-xl border-t border-white/10 px-6 py-4 flex items-center justify-end gap-3"
      >
        <button
          class="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          on:click={closeModal}
          disabled={adding}
        >
          Cancel
        </button>
        <button
          class="px-6 py-2 rounded-xl bg-accent text-white hover:bg-accent/90 transition-colors shadow-lg shadow-accent/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          on:click={handleAddFeed}
          disabled={adding || !feedUrl.trim()}
        >
          {#if adding}
            <Loader2 size={16} class="animate-spin" />
            Adding Feed...
          {:else}
            <PlusCircle size={16} />
            Add Feed
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}
