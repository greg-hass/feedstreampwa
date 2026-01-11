<script lang="ts">
  import { refreshState } from "$lib/stores/feeds";
  import { slide } from "svelte/transition";

  function close() {
    refreshState.update(s => ({ ...s, isRefreshing: false }));
  }
</script>

{#if $refreshState.isRefreshing}
  <div class="refresh-toast glass-panel" transition:slide={{ axis: 'y' }}>
    <div class="toast-content">
      <div class="toast-header">
        <span class="toast-title">Refreshing Feeds</span>
        <button class="toast-close" on:click={close}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <div class="toast-progress-text">
        {$refreshState.current} / {$refreshState.total} • {$refreshState.message || "Starting..."}
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          style="width: {$refreshState.total > 0
            ? ($refreshState.current / $refreshState.total) * 100
            : 0}%"
        ></div>
      </div>
    </div>
  </div>
{/if}

<style>
  .refresh-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    min-width: 320px;
    max-width: 400px;
    padding: 16px 20px;
    z-index: 1500;
  }

  .toast-content {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .toast-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .toast-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .toast-close {
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .toast-close:hover {
    background: var(--panel1);
    color: var(--text);
  }

  .toast-progress-text {
    font-size: 13px;
    color: var(--muted);
  }

  .progress-bar {
    height: 4px;
    background: var(--panel1);
    border-radius: 99px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 99px;
    transition: width 0.3s ease;
  }
</style>
