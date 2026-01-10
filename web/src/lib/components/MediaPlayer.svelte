<script lang="ts">
  import {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Volume2,
    Maximize2,
    X,
  } from "lucide-svelte";

  // Placeholder state
  export let isPlaying = false;
  export let title = "No Media Selected";
  export let artist = "Select a podcast or video";
  export let thumbnail: string | null = null;
</script>

<div
  class="glass border-t border-white/10 p-3 flex items-center gap-3 md:gap-4 w-full relative z-50"
>
  <!-- Progress Bar (Top Edge) -->
  <div
    class="absolute top-0 left-0 right-0 h-[2px] bg-white/5 cursor-pointer group"
  >
    <div
      class="h-full bg-accent/80 w-1/3 group-hover:bg-accent transition-all relative"
    >
      <div
        class="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-custom"
      ></div>
    </div>
  </div>

  <!-- Album Art/Info -->
  <div class="flex items-center gap-3 w-40 md:w-64 flex-shrink-0">
    <div
      class="h-10 w-10 md:h-12 md:w-12 rounded-lg bg-zinc-800 border border-white/10 flex-shrink-0 relative overflow-hidden"
    >
      {#if thumbnail}
        <img src={thumbnail} alt="Art" class="w-full h-full object-cover" />
      {:else}
        <div
          class="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/5 to-white/0"
        >
          <Maximize2 size={16} class="text-white/20" />
        </div>
      {/if}
    </div>
    <div class="flex flex-col overflow-hidden min-w-0">
      <span class="text-sm font-medium text-white truncate leading-tight"
        >{title}</span
      >
      <span class="text-xs text-white/50 truncate leading-tight">{artist}</span>
    </div>
  </div>

  <!-- Controls (Center) -->
  <div class="flex-1 flex justify-center items-center gap-4 md:gap-6">
    <button
      class="text-white/40 hover:text-white transition-colors hidden sm:block"
      ><SkipBack size={20} /></button
    >

    <button
      class="h-9 w-9 md:h-10 md:w-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 hover:bg-gray-200 transition-all shadow-lg shadow-white/10"
      on:click={() => (isPlaying = !isPlaying)}
    >
      {#if isPlaying}
        <Pause size={18} class="fill-current" />
      {:else}
        <Play size={18} class="ml-0.5 fill-current" />
      {/if}
    </button>

    <button
      class="text-white/40 hover:text-white transition-colors hidden sm:block"
      ><SkipForward size={20} /></button
    >
  </div>

  <!-- Volume/Misc (Right) -->
  <div class="w-auto md:w-64 flex justify-end items-center gap-3">
    <div class="hidden md:flex items-center gap-2 group mr-2">
      <Volume2
        size={16}
        class="text-white/40 group-hover:text-white transition-colors"
      />
      <div
        class="w-20 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer"
      >
        <div class="w-2/3 h-full bg-white/80 rounded-full"></div>
      </div>
    </div>
    <button
      class="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
      ><Maximize2 size={18} /></button
    >
  </div>
</div>
