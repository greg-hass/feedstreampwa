<script lang="ts">
  import { page } from "$app/stores";
  import {
    LayoutDashboard,
    Rss,
    Library,
    Settings,
    Search,
    PlusCircle,
  } from "lucide-svelte";
  import { isAddFeedModalOpen, isSettingsModalOpen } from "$lib/stores/ui";

  // Navigation Items
  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "My Feeds", icon: Rss, href: "/feeds" },
    { label: "Library", icon: Library, href: "/library" },
    { label: "Explore", icon: Search, href: "/explore" },
  ];

  $: activeUrl = $page.url.pathname;
</script>

<aside
  class="hidden md:flex flex-col w-[280px] h-screen fixed left-0 top-0 z-40 bg-black/40 backdrop-blur-xl border-r border-white/5"
>
  <!-- Brand -->
  <div class="p-6 pt-8">
    <h1
      class="text-2xl font-bold tracking-tight text-white flex items-center gap-2"
    >
      <div
        class="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20"
      >
        <Rss size={18} class="text-white" />
      </div>
      FeedStream
    </h1>
  </div>

  <!-- Main Nav -->
  <div class="flex-1 px-4 py-2 space-y-1 overflow-y-auto scrollbar-hide">
    <div
      class="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-2"
    >
      Menu
    </div>

    {#each navItems as item}
      <a
        href={item.href}
        class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative overflow-hidden
        {activeUrl === item.href
          ? 'bg-white/10 text-white shadow-inner border border-white/5'
          : 'text-white/60 hover:text-white hover:bg-white/5'}"
      >
        <svelte:component
          this={item.icon}
          size={20}
          class={activeUrl === item.href
            ? "text-accent"
            : "text-current group-hover:text-white"}
        />
        {item.label}

        {#if activeUrl === item.href}
          <div
            class="absolute inset-y-0 left-0 w-1 bg-accent rounded-r-full shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]"
          ></div>
        {/if}
      </a>
    {/each}

    <!-- Smart Folders Section (Mock) -->
    <div
      class="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-8"
    >
      Smart Folders
    </div>
    <button
      class="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
    >
      <span
        class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
      ></span> YouTube
    </button>
    <button
      class="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
    >
      <span
        class="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]"
      ></span> Reddit
    </button>
    <button
      class="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
    >
      <span
        class="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]"
      ></span> Podcasts
    </button>

    <div class="mt-8 px-3">
      <button
        class="flex items-center gap-2 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
        on:click={() => isAddFeedModalOpen.set(true)}
      >
        <PlusCircle size={14} /> New Feed
      </button>
    </div>
  </div>

  <!-- User / Settings at bottom -->
  <div class="p-4 border-t border-white/5">
    <div
      class="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
      on:click={() => isSettingsModalOpen.set(true)}
      on:keydown={(e) => e.key === "Enter" && isSettingsModalOpen.set(true)}
      tabindex="0"
      role="button"
    >
      <div
        class="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 border border-white/10"
      ></div>
      <div class="flex flex-col">
        <span class="text-sm font-medium text-white">User Name</span>
        <span class="text-xs text-white/40">Pro Plan</span>
      </div>
      <Settings size={16} class="ml-auto text-white/40" />
    </div>
  </div>

  <!-- Slot for Player if Desktop -->
  <slot name="player" />
</aside>
