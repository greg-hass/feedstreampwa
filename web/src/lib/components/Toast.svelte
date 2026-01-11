<script lang="ts">
  import { toast, type Toast } from '$lib/stores/toast';
  import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-svelte';
  import { flip } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  };

  function dismissToast(toastId: string) {
    toast.dismiss(toastId);
  }
</script>

{#if $toast.length > 0}
  <div class="toast-container">
    {#each $toast as t (t.id)}
      {@const Icon = icons[t.type]}
      {@const colorClass = colors[t.type]}
      <div
        class="toast-item {colorClass}"
        transition:flip={{ duration: 300, easing: quintOut }}
        role="alert"
        aria-live="polite"
      >
        <div class="toast-content">
          <Icon size={18} class="toast-icon" />
          <span class="toast-message">{t.message}</span>
        </div>
        <button
          class="toast-dismiss"
          on:click={() => dismissToast(t.id)}
          aria-label="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 1000;
    pointer-events: none;
  }

  .toast-item {
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 12px;
    border: 1px solid;
    backdrop-filter: blur(8px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    min-width: 300px;
    max-width: 480px;
  }

  .toast-content {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
  }

  .toast-icon {
    flex-shrink: 0;
  }

  .toast-message {
    font-size: 14px;
    font-weight: 500;
    line-height: 1.4;
  }

  .toast-dismiss {
    flex-shrink: 0;
    padding: 4px;
    border-radius: 6px;
    background: transparent;
    border: none;
    color: inherit;
    opacity: 0.6;
    cursor: pointer;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast-dismiss:hover {
    opacity: 1;
  }

  /* Mobile responsive */
  @media (max-width: 640px) {
    .toast-container {
      bottom: 16px;
      right: 16px;
      left: 16px;
    }

    .toast-item {
      min-width: 0;
      max-width: none;
    }
  }
</style>
