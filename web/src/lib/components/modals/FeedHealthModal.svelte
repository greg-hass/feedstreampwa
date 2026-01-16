<script lang="ts">
  import { onMount } from "svelte";
  import { feeds } from "$lib/stores/feeds";
  import { refreshFeed, removeFeed } from "$lib/stores/feeds";
  import {
    Activity,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    RefreshCw,
    Trash2,
    X,
    Rss,
    Youtube,
    Mic,
    Hash,
  } from "lucide-svelte";
  import RedditIcon from "$lib/components/icons/RedditIcon.svelte";
  import { toast } from "$lib/stores/toast";

  export let isOpen = false;

  type HealthStatus = "healthy" | "error" | "stale" | "never";

  interface HealthGroup {
    status: HealthStatus;
    label: string;
    description: string;
    icon: typeof CheckCircle2;
    color: string;
    feeds: Array<{
      url: string;
      title: string | null;
      kind: "youtube" | "reddit" | "podcast" | "generic";
      last_status: number | null;
      last_error: string | null;
      last_checked: string | null;
      unreadCount?: number;
    }>;
  }

  let healthGroups: HealthGroup[] = [];
  let selectedFilter: HealthStatus | "all" = "all";

  // Determine if a feed is stale (not checked in 7 days)
  function isStale(lastChecked: string | null): boolean {
    if (!lastChecked) return false;
    const checked = new Date(lastChecked);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return checked < weekAgo;
  }

  // Get health status for a feed
  function getHealthStatus(feed: {
    last_status: number | null;
    last_error: string | null;
    last_checked: string | null;
  }): HealthStatus {
    if (!feed.last_checked) return "never";
    if (feed.last_error || (feed.last_status && feed.last_status >= 400)) return "error";
    if (isStale(feed.last_checked)) return "stale";
    if (feed.last_status && feed.last_status >= 200 && feed.last_status < 300) return "healthy";
    return "error";
  }

  // Group feeds by health status
  function calculateHealthGroups(): HealthGroup[] {
    const groups: Record<HealthStatus, any[]> = {
      healthy: [],
      error: [],
      stale: [],
      never: [],
    };

    $feeds.forEach((feed) => {
      const status = getHealthStatus(feed);
      groups[status].push(feed);
    });

    return [
      {
        status: "error",
        label: "Broken Feeds",
        description: "Feeds with errors or failing to fetch",
        icon: XCircle,
        color: "text-red-400",
        feeds: groups.error,
      },
      {
        status: "stale",
        label: "Stale Feeds",
        description: "Not checked in over 7 days",
        icon: Clock,
        color: "text-yellow-400",
        feeds: groups.stale,
      },
      {
        status: "never",
        label: "Never Checked",
        description: "Feeds that haven't been fetched yet",
        icon: AlertTriangle,
        color: "text-orange-400",
        feeds: groups.never,
      },
      {
        status: "healthy",
        label: "Healthy Feeds",
        description: "All systems operational",
        icon: CheckCircle2,
        color: "text-emerald-400",
        feeds: groups.healthy,
      },
    ];
  }

  // Filter groups
  $: filteredGroups =
    selectedFilter === "all"
      ? healthGroups
      : healthGroups.filter((g) => g.status === selectedFilter);

  // Calculate stats
  $: stats = {
    total: $feeds.length,
    healthy: healthGroups.find((g) => g.status === "healthy")?.feeds.length || 0,
    error: healthGroups.find((g) => g.status === "error")?.feeds.length || 0,
    stale: healthGroups.find((g) => g.status === "stale")?.feeds.length || 0,
    never: healthGroups.find((g) => g.status === "never")?.feeds.length || 0,
  };

  // Recalculate when feeds change or modal opens
  $: if (isOpen || $feeds.length > 0) {
    healthGroups = calculateHealthGroups();
  }

  async function handleRefresh(feedUrl: string, event: MouseEvent) {
    event.stopPropagation();
    try {
      await refreshFeed(feedUrl);
      toast.success("Feed refresh started");
    } catch {
      toast.error("Failed to refresh feed");
    }
  }

  async function handleRemove(feedUrl: string, event: MouseEvent) {
    event.stopPropagation();
    try {
      await removeFeed(feedUrl);
      toast.success("Feed removed");
    } catch {
      toast.error("Failed to remove feed");
    }
  }

  function formatLastChecked(dateStr: string | null): string {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function getFeedIcon(kind: string) {
    switch (kind) {
      case "youtube":
        return Youtube;
      case "reddit":
        return RedditIcon;
      case "podcast":
        return Mic;
      default:
        return Rss;
    }
  }

  function getFeedColor(kind: string) {
    switch (kind) {
      case "youtube":
        return "text-red-500";
      case "reddit":
        return "text-orange-400";
      case "podcast":
        return "text-indigo-400";
      default:
        return "text-emerald-400";
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
</script>

{#if isOpen}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    on:click={handleBackdropClick}
    on:keydown={handleBackdropKeydown}
    role="button"
    aria-label="Close dialog"
    tabindex="0"
  >
    <div
      class="bg-[#18181b] rounded-2xl border border-white/10 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="bg-[#18181b] border-b border-white/10 px-6 py-5 flex items-center justify-between flex-shrink-0"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20 flex items-center justify-center"
          >
            <Activity size={20} class="text-emerald-400" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white">Feed Health Dashboard</h2>
            <p class="text-sm text-white/50">Monitor and manage your feed status</p>
          </div>
        </div>
        <button
          class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          on:click={() => (isOpen = false)}
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Stats Overview -->
      <div class="px-6 py-4 border-b border-white/10 flex-shrink-0 bg-white/5">
        <div class="grid grid-cols-4 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-white">{stats.total}</div>
            <div class="text-xs text-white/50">Total Feeds</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-emerald-400">{stats.healthy}</div>
            <div class="text-xs text-white/50">Healthy</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-red-400">{stats.error}</div>
            <div class="text-xs text-white/50">Errors</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-yellow-400">{stats.stale}</div>
            <div class="text-xs text-white/50">Stale</div>
          </div>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div
        class="px-6 py-3 border-b border-white/10 flex-shrink-0 flex items-center gap-2 overflow-x-auto"
      >
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap {selectedFilter ===
          'all'
            ? 'bg-white/10 text-white border border-white/10'
            : 'text-white/60 hover:text-white hover:bg-white/5'}"
          on:click={() => (selectedFilter = "all")}
        >
          All ({stats.total})
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap {selectedFilter ===
          'error'
            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
            : 'text-white/60 hover:text-white hover:bg-white/5'}"
          on:click={() => (selectedFilter = "error")}
        >
          Broken ({stats.error})
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap {selectedFilter ===
          'stale'
            ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
            : 'text-white/60 hover:text-white hover:bg-white/5'}"
          on:click={() => (selectedFilter = "stale")}
        >
          Stale ({stats.stale})
        </button>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap {selectedFilter ===
          'healthy'
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'text-white/60 hover:text-white hover:bg-white/5'}"
          on:click={() => (selectedFilter = "healthy")}
        >
          Healthy ({stats.healthy})
        </button>
      </div>

      <!-- Scrollable Content -->
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        {#each filteredGroups as group}
          {#if group.feeds.length > 0}
            <div class="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
              <!-- Group Header -->
              <div class="px-4 py-3 border-b border-white/5 flex items-center gap-3">
                <svelte:component this={group.icon} size={18} class={group.color} />
                <div class="flex-1">
                  <h3 class="font-semibold text-white">{group.label}</h3>
                  <p class="text-xs text-white/50">{group.description}</p>
                </div>
                <span class="text-sm text-white/40">{group.feeds.length} feeds</span>
              </div>

              <!-- Feed List -->
              <div class="divide-y divide-white/5">
                {#each group.feeds as feed}
                  <div
                    class="px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3 group/item"
                  >
                    <!-- Feed Icon -->
                    <div
                      class="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0"
                    >
                      <svelte:component
                        this={getFeedIcon(feed.kind)}
                        size={16}
                        class={getFeedColor(feed.kind)}
                      />
                    </div>

                    <!-- Feed Info -->
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-medium text-white truncate">{feed.title || feed.url}</span>
                        {#if feed.unreadCount && feed.unreadCount > 0}
                          <span class="text-xs bg-white/10 text-white/60 px-1.5 py-0.5 rounded-full">
                            {feed.unreadCount}
                          </span>
                        {/if}
                      </div>
                      <div class="flex items-center gap-3 text-xs text-white/40 mt-1">
                        <span class="flex items-center gap-1">
                          <Clock size={10} />
                          {formatLastChecked(feed.last_checked)}
                        </span>
                        {#if feed.last_status}
                          <span class="flex items-center gap-1">
                            {feed.last_status >= 200 && feed.last_status < 300
                              ? `Status: ${feed.last_status}`
                              : `Status: ${feed.last_status}`}
                          </span>
                        {/if}
                        {#if feed.last_error}
                          <span class="text-red-400 truncate" title={feed.last_error}>
                            Error: {feed.last_error}
                          </span>
                        {/if}
                      </div>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                      <button
                        class="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-emerald-400 transition-colors"
                        title="Refresh feed"
                        on:click={(e) => handleRefresh(feed.url, e)}
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        class="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-400 transition-colors"
                        title="Remove feed"
                        on:click={(e) => handleRemove(feed.url, e)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        {/each}

        {#if filteredGroups.every((g) => g.feeds.length === 0)}
          <div class="text-center py-12">
            <CheckCircle2 size={48} class="text-emerald-400/50 mx-auto mb-4" />
            <p class="text-white/50">No feeds match this filter</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
