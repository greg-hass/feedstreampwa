<script lang="ts">
  import { Search, X } from "lucide-svelte";

  export let value = "";
  export let placeholder = "Search articles...";
  export let onInput: (value: string) => void = () => {};
  export let onClear: () => void = () => {};
  export let onKeydown: (event: KeyboardEvent) => void = () => {};
</script>

<div class="search-box">
  <Search size={18} class="search-icon" />
  <input
    type="text"
    placeholder={placeholder}
    bind:value={value}
    on:input={() => onInput(value)}
    on:keydown={onKeydown}
  />
  {#if value}
    <button
      class="search-clear"
      on:click={onClear}
      title="Clear search (ESC)"
    >
      <X size={18} />
    </button>
  {/if}
</div>

<style>
  .search-box {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    height: 48px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 999px;
    color: rgba(255, 255, 255, 0.4);
    transition: all 0.2s ease;
    width: 100%;
  }

  .search-icon {
    flex-shrink: 0;
  }

  .search-box:focus-within {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(16, 185, 129, 0.5);
    color: rgba(255, 255, 255, 0.6);
  }

  .search-box input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: white;
    font-size: 15px;
  }

  .search-box input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .search-clear {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 50%;
    transition: color 0.2s;
    flex-shrink: 0;
  }

  .search-clear:hover {
    color: rgba(255, 255, 255, 0.8);
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
