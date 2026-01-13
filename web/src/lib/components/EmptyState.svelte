<script lang="ts">
  import { Rss, Sparkles, FolderPlus, Search } from "lucide-svelte";

  export let type:
    | "no-feeds"
    | "no-articles"
    | "no-results"
    | "no-folder-feeds"
    | "no-starred" = "no-articles";
  export let title: string = "";
  export let description: string = "";
  export let actionText: string = "";
  export let onAction: (() => void) | null = null;

  const configs = {
    "no-feeds": {
      icon: Rss,
      gradient: "from-blue-500 to-cyan-500",
      defaultTitle: "No feeds yet",
      defaultDescription:
        "Start building your personalized feed collection by adding your first source.",
      defaultAction: "Add Your First Feed",
    },
    "no-articles": {
      icon: Rss,
      gradient: "from-purple-500 to-pink-500",
      defaultTitle: "No articles here",
      defaultDescription:
        "This feed is empty. Check back later for new content.",
      defaultAction: "",
    },
    "no-results": {
      icon: Search,
      gradient: "from-orange-500 to-red-500",
      defaultTitle: "No results found",
      defaultDescription:
        "Try adjusting your search or filters to find what you're looking for.",
      defaultAction: "",
    },
    "no-folder-feeds": {
      icon: FolderPlus,
      gradient: "from-green-500 to-emerald-500",
      defaultTitle: "Empty folder",
      defaultDescription:
        "This folder doesn't have any feeds yet. Add some to get started!",
      defaultAction: "Add Feeds",
    },
    "no-starred": {
      icon: Sparkles,
      gradient: "from-yellow-500 to-amber-500",
      defaultTitle: "No bookmarks yet",
      defaultDescription:
        "Star your favorite articles to save them here for later.",
      defaultAction: "",
    },
  };

  $: config = configs[type];
  $: displayTitle = title || config.defaultTitle;
  $: displayDescription = description || config.defaultDescription;
  $: displayAction = actionText || config.defaultAction;
  $: Icon = config.icon;
</script>

<div
  class="flex flex-col items-center justify-center py-20 px-6 text-center animate-fade-in"
>
  <!-- Animated Icon -->
  <div class="relative mb-6">
    <!-- Glow effect -->
    <div
      class="absolute inset-0 bg-gradient-to-r {config.gradient} opacity-20 blur-3xl rounded-full animate-pulse"
    ></div>

    <!-- Icon container -->
    <div
      class="relative w-24 h-24 rounded-2xl bg-gradient-to-br {config.gradient} p-6 shadow-2xl animate-float"
    >
      <Icon size={48} class="text-white" />
    </div>
  </div>

  <!-- Title -->
  <h3
    class="text-2xl font-bold text-white mb-3 animate-slide-up"
    style="animation-delay: 0.1s"
  >
    {displayTitle}
  </h3>

  <!-- Description -->
  <p
    class="text-white/60 max-w-md mb-6 animate-slide-up"
    style="animation-delay: 0.2s"
  >
    {displayDescription}
  </p>

  <!-- Action Button -->
  {#if displayAction && onAction}
    <button
      on:click={onAction}
      class="px-6 py-3 rounded-xl bg-gradient-to-r {config.gradient} text-white font-semibold hover:shadow-lg hover:scale-105 transition-all duration-200 animate-slide-up"
      style="animation-delay: 0.3s"
    >
      {displayAction}
    </button>
  {/if}
</div>

<style>
  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translateY(0px);
    }
    50% {
      transform: translateY(-10px);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.5s ease-out;
  }

  .animate-slide-up {
    animation: slide-up 0.6s ease-out backwards;
  }

  .animate-float {
    animation: float 3s ease-in-out infinite;
  }
</style>
