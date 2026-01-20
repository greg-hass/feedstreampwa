<script lang="ts">
  import "../app.css";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import BottomNav from "$lib/components/BottomNav.svelte";
  import MobileMenu from "$lib/components/MobileMenu.svelte";
  import MediaPlayer from "$lib/components/MediaPlayer.svelte";
  import SettingsModal from "$lib/components/SettingsModal.svelte";
  import AddFeedModal from "$lib/components/AddFeedModal.svelte";
  import Toast from "$lib/components/Toast.svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import ErrorBoundary from "$lib/components/ErrorBoundary.svelte";
  import ReaderView from "$lib/components/ReaderView.svelte";
  import CreateFolderModal from "$lib/components/modals/CreateFolderModal.svelte";
  import RenameModal from "$lib/components/modals/RenameModal.svelte";
  import FeedFolderPopover from "$lib/components/modals/FeedFolderPopover.svelte";
  import ContextMenu from "$lib/components/ContextMenu.svelte";
  import RefreshToast from "$lib/components/RefreshToast.svelte";
  import { currentMedia, mediaType } from "$lib/stores/media";
  import { onMount } from "svelte";
  import { loadFeeds, startRefreshStream } from "$lib/stores/feeds";
  import { loadFolders } from "$lib/stores/folders";
  import { loadSettings } from "$lib/stores/settings";

  // Show player only when there's media loaded and it's not a video
  $: isMediaVisible = $currentMedia !== null && $mediaType !== "video";

  onMount(() => {
    loadFeeds();
    loadFolders();
    loadSettings();
    const stopRefreshStream = startRefreshStream();
    return () => stopRefreshStream();
  });
</script>

<div
  class="min-h-screen bg-background text-gray-200 font-sans selection:bg-accent selection:text-white"
>
  <!-- Skip Links for Keyboard Accessibility -->
  <a
    href="#main-content"
    class="skip-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
  >
    Skip to main content
  </a>

  <!-- Desktop Sidebar (Fixed Left) -->
  <Sidebar />

  <!-- Main Content Area -->
  <!--
    md:pl-[280px]: Offset for sidebar
    pb-[140px]: Bottom padding for Mobile (Nav + Player)
    md:pb-0: No bottom padding needed on desktop (Player in sidebar)
  -->
  <main
    id="main-content"
    tabindex="-1"
    class={`relative w-full min-h-screen md:pl-[280px] pb-[140px] ${isMediaVisible ? "md:pb-[96px]" : "md:pb-0"} transition-all duration-300 ease-out overflow-x-hidden focus:outline-none`}
  >
    <div
      class="w-full max-w-[1600px] mx-auto p-2 md:px-6 md:pt-6 lg:px-8 lg:pt-6"
    >
      <ErrorBoundary>
        <slot />
      </ErrorBoundary>
    </div>
  </main>

  <!-- Full-width Media Player (All sizes) -->
  <!-- Full-width Media Player (Single instance) -->
  {#if isMediaVisible}
    <div class="fixed left-0 right-0 z-50 pointer-events-auto bottom-[64px] md:bottom-0">
      <MediaPlayer />
    </div>
  {/if}

  <!-- Mobile Navigation (Fixed Bottom) -->
  <div class="md:hidden fixed bottom-0 left-0 right-0 z-40 w-full pointer-events-auto">
    <BottomNav />
  </div>

  <!-- Mobile Menu (Slide-in Drawer) -->
  <MobileMenu />

  <!-- Settings Modal (Global Overlay) -->
  <SettingsModal />

  <!-- Add Feed Modal (Global Overlay) -->
  <AddFeedModal />

  <!-- Toast Notifications (Global Overlay) -->
  <Toast />

  <!-- Confirmation Dialog (Global Overlay) -->
  <ConfirmDialog />

  <!-- Other Global Modals -->
  <ReaderView />
  <CreateFolderModal />
  <RenameModal />
  <FeedFolderPopover />
  <ContextMenu />
  <RefreshToast />
</div>

<style>
  /* Global page transition fix for Safari */
  :global(html) {
    background-color: theme("colors.background");
  }
</style>
