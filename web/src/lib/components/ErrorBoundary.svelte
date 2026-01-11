<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertTriangle, RefreshCw } from 'lucide-svelte';

  let hasError = false;
  let errorMessage = '';

  // Error handler function
  function handleError(event: ErrorEvent) {
    event.preventDefault();
    hasError = true;
    errorMessage = event.message || 'An unexpected error occurred';
    console.error('ErrorBoundary caught:', event.error);
  }

  onMount(() => {
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('error', handleError);
    };
  });
</script>

{#if hasError}
  <div class="error-boundary">
    <div class="error-content">
      <div class="error-icon">
        <AlertTriangle size={48} />
      </div>
      <h2 class="error-title">Something went wrong</h2>
      <p class="error-message">{errorMessage}</p>
      <button
        class="error-retry"
        on:click={() => {
          hasError = false;
          errorMessage = '';
          window.location.reload();
        }}
      >
        <RefreshCw size={18} />
        Reload Page
      </button>
    </div>
  </div>
{:else}
  <slot />
{/if}

<style>
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 2rem;
  }

  .error-content {
    text-align: center;
    max-width: 400px;
  }

  .error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    margin: 0 auto 1.5rem;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }

  .error-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    margin: 0 0 0.75rem 0;
  }

  .error-message {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0 0 1.5rem 0;
    line-height: 1.5;
  }

  .error-retry {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 0.75rem;
    color: #10b981;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .error-retry:hover {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.5);
  }
</style>
