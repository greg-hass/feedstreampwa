<script lang="ts">
  export let activeFilter = "all";
  export let filters = ["today", "24h", "week", "all"] as const;
  export let onFilterChange: (filter: string) => void;
</script>

<div class="filter-chips">
  {#each filters as filter}
    <button
      class="chip"
      class:active={activeFilter === filter}
      on:click={() => onFilterChange(filter)}
    >
      {filter}
    </button>
  {/each}
</div>

<style>
  .filter-chips {
    display: flex;
    gap: 8px;
    padding: 16px var(--page-padding);
  }

  .chip {
    padding: 10px 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid var(--stroke);
    border-radius: 999px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .chip:hover {
    background: var(--chip-hover);
    color: var(--text);
    border-color: var(--stroke-strong);
    transform: translateY(-1px);
  }

  .chip.active {
    background: var(--accent);
    color: var(--bg0);
    border-color: var(--accent);
    font-weight: 600;
    box-shadow: 0 4px 12px var(--accent-glow);
  }
</style>
