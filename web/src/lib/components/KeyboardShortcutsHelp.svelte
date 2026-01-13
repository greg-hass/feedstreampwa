<script lang="ts">
  import { X, Keyboard } from "lucide-svelte";
  import { showShortcutsHelp } from "$lib/stores/keyboard";
  import type { KeyboardShortcut } from "$lib/stores/keyboard";

  export let shortcuts: KeyboardShortcut[] = [];

  function close() {
    showShortcutsHelp.set(false);
  }

  function formatKey(shortcut: KeyboardShortcut): string {
    const parts: string[] = [];
    const isMac = navigator.platform.includes("Mac");

    if (shortcut.ctrl) {
      parts.push(isMac ? "⌘" : "Ctrl");
    }
    if (shortcut.shift) {
      parts.push("⇧");
    }
    if (shortcut.alt) {
      parts.push(isMac ? "⌥" : "Alt");
    }

    parts.push(shortcut.key.toUpperCase());

    return parts.join(" + ");
  }

  // Group shortcuts by category
  $: groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.description.includes("Navigate")
        ? "Navigation"
        : shortcut.description.includes("Mark") ||
            shortcut.description.includes("Star")
          ? "Actions"
          : shortcut.description.includes("Search") ||
              shortcut.description.includes("Refresh")
            ? "General"
            : "Other";

      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, KeyboardShortcut[]>
  );
</script>

{#if $showShortcutsHelp}
  <div
    class="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 animate-fade-in"
    on:click={close}
    on:keydown={(e) => e.key === "Escape" && close()}
    role="button"
    tabindex="-1"
  >
    <div
      class="bg-[#18181b] rounded-2xl border border-white/10 max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl"
      on:click|stopPropagation
      on:keydown|stopPropagation
      role="dialog"
      aria-modal="true"
      tabindex="-1"
    >
      <!-- Header -->
      <div
        class="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-t-2xl border-b border-white/10 px-6 py-5 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center"
          >
            <Keyboard size={24} class="text-white" />
          </div>
          <div>
            <h2 class="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
            <p class="text-sm text-white/60">Power user navigation</p>
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
      <div class="overflow-y-auto max-h-[calc(80vh-120px)] p-6">
        {#each Object.entries(groupedShortcuts) as [category, categoryShortcuts]}
          <div class="mb-6 last:mb-0">
            <h3
              class="text-sm font-bold text-white/40 uppercase tracking-wider mb-3"
            >
              {category}
            </h3>
            <div class="space-y-2">
              {#each categoryShortcuts as shortcut}
                <div
                  class="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <span class="text-white/80">{shortcut.description}</span>
                  <kbd
                    class="px-3 py-1.5 rounded-lg bg-gradient-to-br from-white/10 to-white/5 border border-white/20 text-white font-mono text-sm font-semibold shadow-lg"
                  >
                    {formatKey(shortcut)}
                  </kbd>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <!-- Footer -->
      <div class="border-t border-white/10 px-6 py-4 bg-[#18181b]">
        <p class="text-sm text-white/40 text-center">
          Press <kbd
            class="px-2 py-1 rounded bg-white/10 text-white/60 font-mono text-xs"
            >?</kbd
          > anytime to view shortcuts
        </p>
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
