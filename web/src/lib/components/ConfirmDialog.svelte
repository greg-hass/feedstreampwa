<script lang="ts">
  import { confirmDialog, type ConfirmState } from '$lib/stores/confirm';
  import { AlertTriangle, Info, X } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';

  function handleConfirm() {
    confirmDialog.close(true);
  }

  function handleCancel() {
    confirmDialog.close(false);
  }

  function handleBackdropClick() {
    // Close on backdrop click (same as cancel)
    handleCancel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleCancel();
    }
  }

  const icons = {
    danger: AlertTriangle,
    warning: AlertTriangle,
    info: Info,
  };

  const colors = {
    danger: 'text-red-400',
    warning: 'text-yellow-400',
    info: 'text-blue-400',
  };

  const bgs = {
    danger: 'bg-red-500/10 border-red-500/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
  };
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $confirmDialog.isOpen}
  {@const type = $confirmDialog.type || 'info'}
  {@const Icon = icons[type]}
  {@const iconColor = colors[type]}
  {@const iconBg = bgs[type]}
  <div
    class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
    on:click={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    transition:fade={{ duration: 150 }}
  >
    <div
      class="confirm-dialog bg-[#0a0a0b] rounded-2xl border border-white/10 max-w-md w-full shadow-2xl"
      on:click|stopPropagation
      transition:fly={{ duration: 250, y: 50 }}
      role="document"
    >
      <!-- Header -->
      <div class="flex items-start gap-4 p-6 pb-4">
        <div class="flex-shrink-0">
          <div
            class="w-12 h-12 rounded-xl border {iconBg} flex items-center justify-center"
          >
            <Icon size={24} class={iconColor} />
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-semibold text-white mb-1">
            {$confirmDialog.title}
          </h3>
          <p class="text-sm text-white/60 leading-relaxed">
            {$confirmDialog.message}
          </p>
        </div>

        <button
          class="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          on:click={handleCancel}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
        <button
          class="px-4 py-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
          on:click={handleCancel}
        >
          {$confirmDialog.cancelText || 'Cancel'}
        </button>
        <button
          class="px-4 py-2 rounded-xl text-white transition-colors text-sm font-medium {type === 'danger'
            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20'
            : 'bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20'}"
          on:click={handleConfirm}
        >
          {$confirmDialog.confirmText || 'Confirm'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-dialog {
    animation: slideIn 0.25s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
