<script lang="ts">
  import { onMount } from "svelte";
  import { Rss } from "lucide-svelte";
  import { fetchBookmarksTotal } from "$lib/stores/counts";
  import NavigationMenu from "$lib/components/sidebar/NavigationMenu.svelte";
  import SmartFoldersSection from "$lib/components/sidebar/SmartFoldersSection.svelte";
  import FoldersTree from "$lib/components/sidebar/FoldersTree.svelte";
  import SidebarFooter from "$lib/components/sidebar/SidebarFooter.svelte";

  onMount(() => {
    fetchBookmarksTotal();
  });

  let openFolders: Record<string, boolean> = {};
  let isCreatingInline = false;
  let inlineFolderName = "";
  let isSubmitting = false;

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && isCreatingInline) {
      isCreatingInline = false;
      inlineFolderName = "";
    }

    // Global Shortcut: Shift + N for new folder
    if (e.shiftKey && e.key === "N" && !isCreatingInline) {
      const target = e.target as HTMLElement;
      if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
        e.preventDefault();
        isCreatingInline = true;
      }
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<aside
  class="hidden md:flex flex-col w-[280px] h-screen fixed left-0 top-0 z-40 bg-[#121212] border-r border-white/5"
>
  <!-- Brand -->
  <div class="p-6 pt-6 flex-shrink-0">
    <h1
      class="text-2xl font-bold tracking-tight text-white flex items-center gap-2"
    >
      <div
        class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20"
      >
        <Rss size={18} class="text-white" />
      </div>
      FeedStream
    </h1>
  </div>

  <!-- Scrollable Content Area -->
  <div
    class="flex-1 px-4 py-2 overflow-y-auto scrollbar-hide min-h-0"
  >
    <NavigationMenu />
    <SmartFoldersSection />
    <FoldersTree
      bind:openFolders
      bind:isCreatingInline
      bind:inlineFolderName
      bind:isSubmitting
    />
  </div>

  <!-- Footer -->
  <SidebarFooter />

  <!-- Slot for Player if Desktop -->
  <slot name="player" />
</aside>
