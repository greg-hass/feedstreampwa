<script lang="ts">
  import { X, Search } from "lucide-svelte";

  export let value = "";
  export let placeholder = "Search articles...";
  export let onInput: (value: string) => void;
  export let onClear: () => void;
  export let onKeydown: (event: KeyboardEvent) => void;
</script>

<div class="search-box">
  <div class="search-icon-wrapper">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="#10b981" />
      <path
        d="M4.5 6.5h3v3h-1v-2h-2v-1zm4 0h3v1h-2v2h-1v-3z"
        fill="white"
      />
    </svg>
  </div>
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
      <X size={16} />
    </button>
  {/if}
</div>

<style>
  .search-box {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 20px;
    height: 48px;
    background: var(--panel1);
    border: 1px solid var(--stroke);
    border-radius: 999px;
    color: var(--muted);
    transition: all 0.2s ease;
    width: 100%;
  }

  .search-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .search-box:focus-within {
    background: var(--panel0);
    border-color: var(--accent);
    box-shadow: 0 0 0 4px rgba(63, 184, 138, 0.1);
    color: var(--text);
  }

  .search-box input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 15px;
    font-weight: 500;
  }

  .search-box input::placeholder {
    color: var(--muted2);
  }

  .search-clear {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .search-clear:hover {
    color: var(--text);
    background: var(--panel0);
  }
</style>
