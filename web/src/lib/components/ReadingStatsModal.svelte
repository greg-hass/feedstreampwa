<script lang="ts">
  import { onMount } from "svelte";
  import {
    X,
    TrendingUp,
    Clock,
    Star,
    Eye,
    Rss,
    Calendar,
  } from "lucide-svelte";

  export let isOpen = false;

  interface ReadingStats {
    totalArticles: number;
    readArticles: number;
    starredArticles: number;
    totalFeeds: number;
    readingStreak: number;
    avgReadTime: number;
    topFeeds: Array<{ name: string; count: number }>;
    readByDay: Array<{ day: string; count: number }>;
  }

  let stats: ReadingStats | null = null;
  let loading = true;

  async function loadStats() {
    loading = true;
    try {
      // Fetch stats from API
      const response = await fetch("/api/stats");
      if (response.ok) {
        stats = await response.json();
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      loading = false;
    }
  }

  function close() {
    isOpen = false;
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.currentTarget !== event.target) return;
    close();
  }

  function handleBackdropKeydown(e: KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      close();
    }
  }

  $: if (isOpen) {
    loadStats();
  }

  $: readPercentage = stats
    ? Math.round((stats.readArticles / stats.totalArticles) * 100) || 0
    : 0;
</script>

{#if isOpen}
  <div
    class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in"
    on:click={handleBackdropClick}
    on:keydown={handleBackdropKeydown}
    role="button"
    aria-label="Close dialog"
    tabindex="0"
  >
    <div
      class="bg-[#18181b] rounded-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-t-2xl border-b border-white/10 px-6 py-5 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center"
          >
            <TrendingUp size={24} class="text-white" />
          </div>
          <div>
            <h2 class="text-2xl font-bold text-white">Reading Stats</h2>
            <p class="text-sm text-white/60">
              Your reading habits and insights
            </p>
          </div>
        </div>
        <button
          class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          on:click={close}
          aria-label="Close"
        >
          <X size={24} />
        </button>
      </div>

      <!-- Body -->
      <div class="overflow-y-auto max-h-[calc(90vh-120px)] p-6">
        {#if loading}
          <div class="flex items-center justify-center py-20">
            <div
              class="w-12 h-12 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin"
            ></div>
          </div>
        {:else if stats}
          <!-- Stats Grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <!-- Total Articles -->
            <div
              class="p-4 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20"
            >
              <div class="flex items-center gap-2 mb-2">
                <Rss size={16} class="text-accent" />
                <span class="text-xs text-white/60">Total Articles</span>
              </div>
              <p class="text-3xl font-bold text-white">{stats.totalArticles}</p>
            </div>

            <!-- Read Articles -->
            <div
              class="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20"
            >
              <div class="flex items-center gap-2 mb-2">
                <Eye size={16} class="text-green-400" />
                <span class="text-xs text-white/60">Read</span>
              </div>
              <p class="text-3xl font-bold text-white">{stats.readArticles}</p>
              <p class="text-xs text-green-400 mt-1">{readPercentage}%</p>
            </div>

            <!-- Starred -->
            <div
              class="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/20"
            >
              <div class="flex items-center gap-2 mb-2">
                <Star size={16} class="text-yellow-400" />
                <span class="text-xs text-white/60">Starred</span>
              </div>
              <p class="text-3xl font-bold text-white">
                {stats.starredArticles}
              </p>
            </div>

            <!-- Reading Streak -->
            <div
              class="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20"
            >
              <div class="flex items-center gap-2 mb-2">
                <Calendar size={16} class="text-orange-400" />
                <span class="text-xs text-white/60">Streak</span>
              </div>
              <p class="text-3xl font-bold text-white">{stats.readingStreak}</p>
              <p class="text-xs text-orange-400 mt-1">days</p>
            </div>
          </div>

          <!-- Top Feeds -->
          {#if stats.topFeeds && stats.topFeeds.length > 0}
            <div class="mb-6">
              <h3
                class="text-lg font-bold text-white mb-4 flex items-center gap-2"
              >
                <TrendingUp size={20} class="text-green-400" />
                Top Feeds
              </h3>
              <div class="space-y-2">
                {#each stats.topFeeds.slice(0, 5) as feed, i}
                  <div
                    class="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-white font-medium">{feed.name}</span>
                      <span class="text-white/60 text-sm"
                        >{feed.count} articles</span
                      >
                    </div>
                    <div class="w-full bg-white/10 rounded-full h-2">
                      <div
                        class="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
                        style="width: {(feed.count / stats.topFeeds[0].count) *
                          100}%"
                      ></div>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Reading Activity -->
          {#if stats.readByDay && stats.readByDay.length > 0}
            <div>
              <h3
                class="text-lg font-bold text-white mb-4 flex items-center gap-2"
              >
                <Clock size={20} class="text-accent" />
                Reading Activity (Last 7 Days)
              </h3>
              <div class="grid grid-cols-7 gap-2">
                {#each stats.readByDay as day}
                  <div class="text-center">
                    <div
                      class="h-20 rounded-lg bg-gradient-to-t from-accent/20 to-accent/5 border border-accent/20 flex items-end justify-center p-2 hover:from-accent/30 hover:to-accent/10 transition-all"
                      title="{day.day}: {day.count} articles"
                    >
                      <div
                        class="w-full bg-gradient-to-t from-blue-500 to-cyan-500 rounded transition-all"
                        style="height: {Math.max(
                          (day.count /
                            Math.max(...stats.readByDay.map((d) => d.count))) *
                            100,
                          5
                        )}%"
                      ></div>
                    </div>
                    <p class="text-xs text-white/40 mt-2">{day.day}</p>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {:else}
          <div class="text-center py-20">
            <p class="text-white/60">No stats available yet. Start reading!</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
</style>
