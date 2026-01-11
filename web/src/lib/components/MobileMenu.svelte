<script lang="ts">
  import { page } from "$app/stores";
  import {
    X,
    LayoutDashboard,
    List,
    Bookmark,
    Settings,
    PlusCircle,
    Rss,
    Youtube,
    Hash,
    Radio,
  } from "lucide-svelte";
  import {
    isMobileMenuOpen,
    isAddFeedModalOpen,
    isSettingsModalOpen,
    viewMode,
    activeSmartFolder,
    setViewSmartFolder,
  } from "$lib/stores/ui";

  $: activeUrl = $page.url.pathname;

  // Navigation Items
  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Feeds", icon: List, href: "/feeds" },
    { label: "Library", icon: Bookmark, href: "/library" },
  ];

  // Smart folders
  const smartFolders = [
    {
      id: "youtube" as const,
      label: "YouTube",
      color: "red-500",
      icon: Youtube
    },
    {
      id: "reddit" as const,
      label: "Reddit",
      color: "orange-500",
      icon: Hash
    },
    {
      id: "podcast" as const,
      label: "Podcasts",
      color: "purple-500",
      icon: Radio
    },
  ];

  function closeMenu() {
    isMobileMenuOpen.set(false);
  }

  function handleSmartFolderClick(folderId: typeof smartFolders[number]["id"]) {
    setViewSmartFolder(folderId);
    // Navigate to home page to show the filtered items
    window.location.href = "/";
    closeMenu();
  }

  function handleNavClick() {
    closeMenu();
  }

  function handleAddFeed() {
    closeMenu();
    isAddFeedModalOpen.set(true);
  }

  function handleSettings() {
    closeMenu();
    isSettingsModalOpen.set(true);
  }

  // Close menu when clicking backdrop
  function handleBackdropClick() {
    closeMenu();
  }

  // Close on escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && $isMobileMenuOpen) {
      closeMenu();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $isMobileMenuOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === "Enter" && handleBackdropClick()}
    role="button"
    tabindex="-1"
    transition:fade={{ duration: 200 }}
  />

  <!-- Slide-in Menu -->
  <aside
    class="fixed left-0 top-0 h-full w-[280px] bg-black/95 backdrop-blur-xl border-r border-white/10 z-[70] md:hidden overflow-y-auto"
    transition:fly={{ x: -280, duration: 300, opacity: 1 }}
  >
    <!-- Header -->
    <div class="p-6 pt-8 flex items-center justify-between">
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
      <button
        class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
        on:click={closeMenu}
        aria-label="Close menu"
      >
        <X size={20} />
      </button>
    </div>

    <!-- Main Nav -->
    <div class="px-4 py-2 space-y-1">
      <div
        class="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-2"
      >
        Menu
      </div>

      {#each navItems as item}
        <a
          href={item.href}
          on:click={handleNavClick}
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

      <!-- Smart Folders Section -->
      <div
        class="text-xs font-semibold text-white/40 uppercase tracking-wider px-3 mb-2 mt-8"
      >
        Smart Folders
      </div>
      {#each smartFolders as folder}
        <button
          class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group relative overflow-hidden
            {$viewMode === 'smart' && $activeSmartFolder === folder.id
              ? 'bg-white/10 text-white shadow-inner border border-white/5'
              : 'text-white/60 hover:text-white hover:bg-white/5'}"
          on:click={() => handleSmartFolderClick(folder.id)}
        >
          <svelte:component
            this={folder.icon}
            size={20}
            class="text-{folder.color}"
          />
          {folder.label}

          {#if $viewMode === 'smart' && $activeSmartFolder === folder.id}
            <div
              class="absolute inset-y-0 left-0 w-1 bg-{folder.color} rounded-r-full shadow-[0_0_10px_2px_rgba(239,68,68,0.5)]"
            ></div>
          {/if}
        </button>
      {/each}

      <!-- Add Feed Button -->
      <div class="mt-8 px-3">
        <button
          class="flex items-center gap-2 text-xs font-medium text-accent hover:text-accent/80 transition-colors"
          on:click={handleAddFeed}
        >
          <PlusCircle size={14} /> New Feed
        </button>
      </div>
    </div>

    <!-- Settings at bottom -->
    <div class="p-4 border-t border-white/5 mt-auto">
      <button
        class="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors w-full"
        on:click={handleSettings}
      >
        <div
          class="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 border border-white/10"
        ></div>
        <div class="flex flex-col text-left flex-1">
          <span class="text-sm font-medium text-white">User Name</span>
          <span class="text-xs text-white/40">Pro Plan</span>
        </div>
        <Settings size={16} class="text-white/40" />
      </button>
    </div>
  </aside>
{/if}

<script context="module">
  import { fade, fly } from "svelte/transition";
</script>
