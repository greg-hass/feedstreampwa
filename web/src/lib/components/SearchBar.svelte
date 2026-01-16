<script lang="ts">
  import { Search, X } from "lucide-svelte";

  export let value = "";
  export let placeholder = "Search articles...";
  export let onInput: (value: string) => void = () => {};
  export let onClear: () => void = () => {};
  export let onKeydown: (event: KeyboardEvent) => void = () => {};
</script>

<div class="search-box">
  <span class="search-icon" aria-hidden="true">
    <Search size={18} />
  </span>
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
    background: #18181b; /* Zinc 900 */
    border: 1px solid #27272a; /* Zinc 800 */
    border-radius: 999px;
    color: #71717a; /* Zinc 500 */
    transition: all 0.2s ease;
    width: 100%;
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
    background: #27272a; /* Zinc 800 */
    border-color: rgba(16, 185, 129, 0.5);
    color: white;
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
    color: #71717a; /* Zinc 500 */
  }

  .search-clear {
    background: none;
    border: none;
    color: #71717a; /* Zinc 500 */
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 999px;
    transition: color 0.2s;
    flex-shrink: 0;
    line-height: 0;
  }

  .search-clear:hover {
    color: white;
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
