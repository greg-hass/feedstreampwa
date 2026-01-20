<script lang="ts">
  import { onMount } from 'svelte';
  import { AlertTriangle, RefreshCw, Home, RotateCcw, HelpCircle } from 'lucide-svelte';

  let hasError = false;
  let errorMessage = '';
  let errorStack = '';
  let retryCount = 0;
  const maxRetries = 3;

  // Error handler function
  function handleError(event: ErrorEvent) {
    event.preventDefault();
    hasError = true;
    errorMessage = event.message || 'An unexpected error occurred';
    errorStack = event.error?.stack || '';
    console.error('ErrorBoundary caught:', event.error);
  }

  function handleRetry() {
    retryCount++;
    hasError = false;
    errorMessage = '';
    errorStack = '';
    // Force re-render of slot content
  }

  function handleReload() {
    window.location.reload();
  }

  function handleGoHome() {
    window.location.href = '/';
  }

  function handleClearAndRetry() {
    // Clear local storage cache that might be corrupted
    try {
      const keysToPreserve = ['feedstream-settings', 'feedstream-theme'];
      const preserved: Record<string, string | null> = {};
      keysToPreserve.forEach(key => {
        preserved[key] = localStorage.getItem(key);
      });
      localStorage.clear();
      keysToPreserve.forEach(key => {
        if (preserved[key]) localStorage.setItem(key, preserved[key]!);
      });
    } catch (e) {
      console.warn('Failed to clear cache:', e);
    }
    window.location.reload();
  }

  $: canRetry = retryCount < maxRetries;

  onMount(() => {
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('error', handleError);
    };
  });
</script>

{#if hasError}
  <div class="error-boundary" role="alert" aria-live="assertive">
    <div class="error-content">
      <div class="error-icon">
        <AlertTriangle size={48} />
      </div>
      <h2 class="error-title">Something went wrong</h2>
      <p class="error-message">{errorMessage}</p>

      {#if retryCount > 0}
        <p class="error-hint">
          Retry attempt {retryCount} of {maxRetries}. If the problem persists, try clearing cache.
        </p>
      {/if}

      <div class="error-actions">
        {#if canRetry}
          <button
            class="error-retry error-retry-primary"
            on:click={handleRetry}
            aria-label="Try again without reloading"
          >
            <RotateCcw size={18} />
            Try Again
          </button>
        {/if}

        <button
          class="error-retry"
          on:click={handleReload}
          aria-label="Reload the entire page"
        >
          <RefreshCw size={18} />
          Reload Page
        </button>

        <button
          class="error-retry error-retry-secondary"
          on:click={handleClearAndRetry}
          aria-label="Clear cached data and reload"
        >
          Clear Cache & Retry
        </button>

        <button
          class="error-retry error-retry-ghost"
          on:click={handleGoHome}
          aria-label="Go back to home page"
        >
          <Home size={18} />
          Go Home
        </button>
      </div>

      <details class="error-details">
        <summary class="error-details-toggle">
          <HelpCircle size={14} />
          Technical Details
        </summary>
        <pre class="error-stack">{errorStack || 'No stack trace available'}</pre>
      </details>
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
    max-width: 500px;
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
    margin: 0 0 1rem 0;
    line-height: 1.5;
  }

  .error-hint {
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0 0 1.5rem 0;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
  }

  .error-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .error-retry {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.75rem;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 44px;
  }

  .error-retry:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .error-retry-primary {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    color: #10b981;
  }

  .error-retry-primary:hover {
    background: rgba(16, 185, 129, 0.25);
    border-color: rgba(16, 185, 129, 0.5);
  }

  .error-retry-secondary {
    background: rgba(251, 191, 36, 0.1);
    border-color: rgba(251, 191, 36, 0.3);
    color: #fbbf24;
  }

  .error-retry-secondary:hover {
    background: rgba(251, 191, 36, 0.2);
    border-color: rgba(251, 191, 36, 0.5);
  }

  .error-retry-ghost {
    background: transparent;
    border-color: transparent;
    color: rgba(255, 255, 255, 0.5);
  }

  .error-retry-ghost:hover {
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
  }

  .error-details {
    margin-top: 1rem;
    text-align: left;
  }

  .error-details-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .error-details-toggle:hover {
    color: rgba(255, 255, 255, 0.6);
    background: rgba(255, 255, 255, 0.05);
  }

  .error-stack {
    margin-top: 0.75rem;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 0.5rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 200px;
    overflow-y: auto;
  }
</style>
