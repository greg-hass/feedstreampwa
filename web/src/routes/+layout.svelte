<script lang="ts">
  import "../app.css";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import BottomNav from "$lib/components/BottomNav.svelte";
  import MediaPlayer from "$lib/components/MediaPlayer.svelte";

  // In a real app, this would be reactive from a store
  let isMediaVisible = true;
</script>

<div
  class="min-h-screen bg-background text-gray-200 font-sans selection:bg-accent selection:text-white"
>
  <!-- Desktop Sidebar (Fixed Left) -->
  <Sidebar>
    <!-- Inject Player into Sidebar Slot for Desktop -->
    <div slot="player" class="mt-auto border-t border-white/5">
      {#if isMediaVisible}
        <!-- Condensed version for Sidebar could be passed via props, but CSS response works too -->
        <MediaPlayer />
      {/if}
    </div>
  </Sidebar>

  <!-- Main Content Area -->
  <!-- 
    md:pl-[280px]: Offset for sidebar 
    pb-[140px]: Bottom padding for Mobile (Nav + Player) 
    md:pb-0: No bottom padding needed on desktop (Player in sidebar)
  -->
  <main
    class="relative w-full min-h-screen md:pl-[280px] pb-[140px] md:pb-0 transition-all duration-300 ease-out"
  >
    <div
      class="w-full max-w-[1600px] mx-auto p-4 md:p-8 lg:p-10 animate-in fade-in slide-in-from-bottom-2 duration-500"
    >
      <slot />
    </div>
  </main>

  <!-- Mobile Floating Elements (Fixed Bottom) -->
  <div class="md:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col">
    <!-- Mobile Media Player (Above Nav) -->
    {#if isMediaVisible}
      <div
        class="w-full pb-[64px] transition-transform duration-300 slide-in-from-bottom-10"
      >
        <MediaPlayer />
      </div>
    {/if}

    <!-- Mobile Navigation (Absolute Bottom) -->
    <div class="absolute bottom-0 w-full">
      <BottomNav />
    </div>
  </div>
</div>

<style>
  /* Global page transition fix for Safari */
  :global(html) {
    background-color: theme("colors.background");
  }
</style>
