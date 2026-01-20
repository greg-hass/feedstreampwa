<script lang="ts">
  import { MessageSquare, MessageCircle, ExternalLink } from "lucide-svelte";
  import type { Discussion } from "$lib/types";

  export let showDiscussions: boolean;
  export let discussions: Discussion[];
  export let discussionsLoading: boolean;
  export let toggleDiscussions: () => void;
</script>

{#if showDiscussions}
  <div class="discussions-panel">
    <div class="p-4 border-b border-white/10 flex items-center justify-between bg-[#0a0a0c]">
      <h3 class="font-bold text-lg text-white flex items-center gap-2">
        <MessageSquare size={18} class="text-accent" />
        Context
      </h3>
      <button class="p-1 hover:bg-white/10 rounded" on:click={toggleDiscussions}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
          <path d="M15 5L5 15M5 5l10 10" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <div class="p-4 overflow-y-auto h-[calc(100vh-60px)]">
      {#if discussionsLoading}
        <div class="flex flex-col items-center py-10 text-white/50 gap-3">
          <div class="w-6 h-6 border-2 border-white/20 border-t-accent rounded-full animate-spin"></div>
          <span class="text-sm">Searching communities...</span>
        </div>
      {:else if discussions.length === 0}
        <div class="text-center py-10 text-white/50">
          <p>No discussions found on Hacker News or Reddit.</p>
        </div>
      {:else}
        <div class="space-y-4">
          {#each discussions as discussion}
            <a
              href={discussion.url}
              target="_blank"
              rel="noopener noreferrer"
              class="block p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group"
            >
              <div class="flex items-start gap-3">
                <div class="shrink-0 mt-1">
                  {#if discussion.source === "hackernews"}
                    <div class="w-6 h-6 flex items-center justify-center bg-[#ff6600] text-white font-bold text-xs rounded">Y</div>
                  {:else}
                    <div class="w-6 h-6 flex items-center justify-center bg-[#ff4500] text-white font-bold text-xs rounded-full">R</div>
                  {/if}
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-white/90 leading-snug mb-1 group-hover:text-accent transition-colors line-clamp-2">
                    {discussion.title}
                  </h4>
                  <div class="flex items-center gap-3 text-xs text-white/50">
                    <span class="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 20v-6M6 20V10M18 20V4" />
                      </svg>
                      {discussion.score}
                    </span>
                    <span class="flex items-center gap-1">
                      <MessageCircle size={12} />
                      {discussion.commentsCount}
                    </span>
                    {#if discussion.subreddit}
                      <span class="text-white/40">r/{discussion.subreddit}</span>
                    {/if}
                  </div>
                </div>
                <ExternalLink size={14} class="text-white/20 group-hover:text-white/60 shrink-0" />
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .discussions-panel {
    position: fixed;
    right: 0;
    top: 0;
    width: 100%;
    max-width: 400px;
    height: 100vh;
    background: #0a0a0c;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    z-index: 2100;
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
    animation: slideInRight 0.3s ease-out;
  }

  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
</style>
