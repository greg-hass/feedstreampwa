<script lang="ts">
  import { Search, X } from "lucide-svelte";

  export let value = "";
  export let placeholder = "Search articles...";
  export let onInput: (value: string) => void = () => {};
  export let onClear: () => void = () => {};
  export let onKeydown: (event: KeyboardEvent) => void = () => {};
  export let inputEl: HTMLInputElement | null = null;
</script>

<div class="search-box">
  <span class="search-icon" aria-hidden="true">
    <Search size={18} />
  </span>
  <input
    bind:this={inputEl}
    type="text"
    {placeholder}
    bind:value
    on:input={() => onInput(value)}
    on:keydown={onKeydown}
  />
  {#if value}
    <button class="search-clear" on:click={onClear} title="Clear search (ESC)">
      <X size={18} />
    </button>
  {/if}
</div>

<style>
  .search-box {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 18px;
    height: 52px;
    background: var(--tw-colors-surface);
    border: 1px solid var(--tw-colors-stroke);
    border-radius: 999px;
    color: var(--text-muted);
    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    width: 100%;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .search-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    line-height: 0;
  }

  .search-box:focus-within {
    background: var(--tw-colors-raised);
    border-color: var(--tw-colors-accent);
    color: var(--text-base);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }

  .search-box input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-base);
    font-size: 16px;
    font-weight: 500;
  }

  .search-box input::placeholder {
    color: var(--text-muted);
    opacity: 0.7;
  }

  .search-clear {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border-radius: 999px;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .search-clear:hover {
    color: var(--text-base);
    background: rgba(255, 255, 255, 0.05);
  }

  /* Mobile responsive */
  @media (max-width: 768px) {
    .search-box {
      height: 44px;
      padding: 0 16px;
      font-size: 17px;
    }
  }
</style>
