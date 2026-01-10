<script lang="ts">
  import { page } from "$app/stores";
  import { LayoutDashboard, Rss, Library, Search } from "lucide-svelte";

  const items = [
    { label: "Home", icon: LayoutDashboard, href: "/" },
    { label: "Feeds", icon: Rss, href: "/feeds" },
    { label: "Search", icon: Search, href: "/explore" },
    { label: "Library", icon: Library, href: "/library" },
  ];

  $: activeUrl = $page.url.pathname;
</script>

<nav
  class="md:hidden fixed bottom-0 left-0 right-0 h-[64px] bg-[#050507]/90 backdrop-blur-xl border-t border-white/10 z-40 flex items-center justify-around px-2 pb-safe select-none"
>
  {#each items as item}
    <a
      href={item.href}
      class="flex flex-col items-center justify-center w-full h-full gap-1 active:scale-95 transition-transform duration-100"
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
