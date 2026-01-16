<script lang="ts">
  import { Palette } from "lucide-svelte";
  import { theme, colorSchemes, type ColorScheme, type ThemeMode } from "$lib/stores/theme";
  import type { Settings } from "$lib/types";

  export let localSettings: Settings;
  export let showCustomColors = false;
  export let customColors = {
    primary: "#10B981",
    background: "#050507",
    surface: "#0e0e11",
    raised: "#16161a",
  };

  function handleThemeChange(mode: ThemeMode) {
    theme.setMode(mode);
  }

  function handleColorSchemeChange(scheme: string) {
    theme.setColorScheme(scheme as ColorScheme);
  }

  function applyCustomColors() {
    theme.setCustomColors(customColors);
  }

  const syncIntervalOptions = [
    { value: "off", label: "Off" },
    { value: "15m", label: "15m" },
    { value: "1h", label: "1h" },
    { value: "4h", label: "4h" },
  ];
</script>

<div class="space-y-8">
  <!-- Appearance - Color Schemes -->
  <div class="space-y-3">
    <span class="text-sm font-semibold text-white flex items-center gap-2">
      <Palette size={16} />
      Color Scheme
    </span>
    <div class="grid grid-cols-3 gap-3">
      {#each Object.entries(colorSchemes) as [key, scheme]}
        {@const isActive = $theme.colorScheme === key}
        <button
          type="button"
          class="p-3 rounded-xl border transition-all text-left {isActive
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'}"
          on:click={() => handleColorSchemeChange(key)}
        >
          <div class="flex items-center gap-2 mb-1">
            <div
              class="w-4 h-4 rounded-full shadow-lg"
              style="background-color: {scheme.accent}"
            ></div>
            <div class="font-medium text-sm">{scheme.name}</div>
          </div>
          <div class="text-[11px] opacity-60">
            {scheme.description}
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Custom Colors (Advanced) -->
  <div class="space-y-3">
    {#if $theme.colorScheme === "custom" || showCustomColors}
      <div class="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
        <div class="flex items-center justify-between">
          <span class="text-sm font-semibold text-white">Custom Colors</span>
          <button
            type="button"
            class="text-xs px-3 py-1 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            on:click={applyCustomColors}
          >
            Apply Colors
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-xs text-white/60">Primary Accent</label>
            <div class="flex items-center gap-2">
              <input type="color" bind:value={customColors.primary} class="w-8 h-8 rounded cursor-pointer" />
              <input
                type="text"
                bind:value={customColors.primary}
                class="flex-1 bg-white/5 px-2 py-1 rounded text-sm text-white border border-white/10"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-xs text-white/60">Background</label>
            <div class="flex items-center gap-2">
              <input type="color" bind:value={customColors.background} class="w-8 h-8 rounded cursor-pointer" />
              <input
                type="text"
                bind:value={customColors.background}
                class="flex-1 bg-white/5 px-2 py-1 rounded text-sm text-white border border-white/10"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-xs text-white/60">Surface</label>
            <div class="flex items-center gap-2">
              <input type="color" bind:value={customColors.surface} class="w-8 h-8 rounded cursor-pointer" />
              <input
                type="text"
                bind:value={customColors.surface}
                class="flex-1 bg-white/5 px-2 py-1 rounded text-sm text-white border border-white/10"
              />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-xs text-white/60">Raised</label>
            <div class="flex items-center gap-2">
              <input type="color" bind:value={customColors.raised} class="w-8 h-8 rounded cursor-pointer" />
              <input
                type="text"
                bind:value={customColors.raised}
                class="flex-1 bg-white/5 px-2 py-1 rounded text-sm text-white border border-white/10"
              />
            </div>
          </div>
        </div>
      </div>
    {:else}
      <button
        type="button"
        class="text-xs px-3 py-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        on:click={() => (showCustomColors = true)}
      >
        + Custom Colors
      </button>
    {/if}
  </div>

  <div class="space-y-3">
    <span class="text-sm font-semibold text-white mb-3 block">Auto-sync Interval</span>
    <select
      bind:value={localSettings.sync_interval}
      class="w-full bg-white/5 px-4 py-3 rounded-xl text-white border border-white/10 hover:bg-white/10 focus:border-accent/50 transition-colors outline-none text-sm appearance-none"
      style="-webkit-appearance: none;"
    >
      {#each syncIntervalOptions as option}
        <option value={option.value} class="bg-zinc-900 text-white">{option.label}</option>
      {/each}
    </select>
  </div>

  <div class="space-y-3">
    <div class="flex items-center justify-between mb-3">
      <span class="text-sm font-semibold text-white flex items-center gap-2">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M2 17l10 5 10-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M2 12l10 5 10-5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Gemini API Key
      </span>
      <span class="text-xs text-white/40">Optional</span>
    </div>
    <input
      type="text"
      bind:value={localSettings.gemini_api_key}
      placeholder="Enter your Gemini API key..."
      autocomplete="off"
      class="w-full bg-white/5 px-4 py-3 rounded-xl text-white border border-white/10 hover:bg-white/10 focus:border-accent/50 transition-colors outline-none text-sm font-mono"
    />
    <p class="text-xs text-white/40 mt-2">
      Enable AI-powered feed recommendations. Get your API key from
      <a
        href="https://aistudio.google.com/app/apikey"
        target="_blank"
        rel="noopener noreferrer"
        class="text-purple-400 hover:text-purple-300 underline"
      >
        Google AI Studio
      </a>
      . Your key is stored securely on the server and never exposed to the browser.
    </p>
  </div>
</div>
