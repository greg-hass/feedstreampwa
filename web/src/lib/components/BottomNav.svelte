<script lang="ts">
  import { page } from "$app/stores";
  import { LayoutDashboard, List, Bookmark, Menu } from "lucide-svelte";
  import { isMobileMenuOpen, setViewAll } from "$lib/stores/ui";

  const items = [
    { label: "Feeds", icon: List, href: "/feeds" },
    { label: "Library", icon: Bookmark, href: "/library" },
  ];

  $: activeUrl = $page.url.pathname;

  function openMenu() {
    isMobileMenuOpen.set(true);
  }

  function handleAllArticlesClick() {
    setViewAll();
  }
</script>

<nav
  class="md:hidden fixed bottom-0 left-0 right-0 min-h-[64px] bg-background border-t border-white/5 z-40 flex items-center justify-around px-2 pt-2 pb-safe select-none"
>
  <!-- Menu Button -->
  <button
    on:click={openMenu}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
  >
    <div
      class="relative p-1.5 rounded-xl transition-all duration-300 {$isMobileMenuOpen
        ? 'bg-white/10'
        : ''}"
    >
      <Menu
        size={22}
        class="transition-colors duration-300 {$isMobileMenuOpen
          ? 'text-white'
          : 'text-white/40'}"
        strokeWidth={$isMobileMenuOpen ? 2.5 : 2}
      />
      {#if $isMobileMenuOpen}
        <span
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"
        ></span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium {$isMobileMenuOpen
        ? 'text-white'
        : 'text-white/40'}"
    >
      Menu
    </span>
  </button>

  <!-- All Articles Button -->
  <a
    href="/"
    on:click={handleAllArticlesClick}
    class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
  >
    <div
      class="relative p-1.5 rounded-xl transition-all duration-300 {activeUrl === '/'
        ? 'bg-white/10'
        : ''}"
    >
      <LayoutDashboard
        size={22}
        class="transition-colors duration-300 {activeUrl === '/'
          ? 'text-white'
          : 'text-white/40'}"
        strokeWidth={activeUrl === '/' ? 2.5 : 2}
      />
      {#if activeUrl === '/'}
        <span
          class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"
        ></span>
      {/if}
    </div>
    <span
      class="text-[10px] font-medium {activeUrl === '/'
        ? 'text-white'
        : 'text-white/40'}"
    >
      All Articles
    </span>
  </a>

  {#each items as item}
    <a
      href={item.href}
      class="flex flex-col items-center justify-center w-full gap-1 active:scale-95 transition-transform duration-100 py-2"
    >
      <div
        class="relative p-1.5 rounded-xl transition-all duration-300 {activeUrl ===
        item.href
          ? 'bg-white/10'
          : ''}"
      >
        <svelte:component
          this={item.icon}
          size={22}
          class="transition-colors duration-300 {activeUrl === item.href
            ? 'text-white'
            : 'text-white/40'}"
          strokeWidth={activeUrl === item.href ? 2.5 : 2}
        />
        {#if activeUrl === item.href}
          <span
            class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"
          ></span>
        {/if}
      </div>
      <span
        class="text-[10px] font-medium {activeUrl === item.href
          ? 'text-white'
          : 'text-white/40'}"
      >
        {item.label}
      </span>
    </a>
  {/each}
</nav>
