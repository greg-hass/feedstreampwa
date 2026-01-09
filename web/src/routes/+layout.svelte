<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	onMount(() => {
		// Register service worker only in production build
		if (browser && 'serviceWorker' in navigator && import.meta.env.PROD) {
			navigator.serviceWorker.register('/sw.js').catch((err) => {
				console.error('Service worker registration failed:', err);
			});
		}
	});
</script>

<slot />

<style>
	:global(:root) {
		/* Black & Green Theme */
		--bg: #0a0a0a;
		--panel: #141414;
		--panel2: #1a1a1a;
		--text: #e8e8e8;
		--muted: #8a9a8a;
		--border: #2a2a2a;
		
		/* Green Accents */
		--accent: #00e676;
		--accent-hover: #00ff88;
		--accent-dim: #00b359;
		--accent-glow: rgba(0, 230, 118, 0.2);
		
		/* Status Colors */
		--danger: #ff5252;
		--danger-dim: rgba(255, 82, 82, 0.1);
		--success: #00e676;
		--warning: #ffc107;
		
		/* Shadows */
		--shadow: rgba(0, 0, 0, 0.5);
		--shadow-lg: rgba(0, 0, 0, 0.7);
		
		/* Focus */
		--focus-ring: 0 0 0 3px var(--accent-glow);
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: var(--bg);
		color: var(--text);
		min-height: 100vh;
	}

	:global(*) {
		box-sizing: border-box;
	}

	/* Focus styles for accessibility */
	:global(*:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Scrollbar styling */
	:global(::-webkit-scrollbar) {
		width: 12px;
		height: 12px;
	}

	:global(::-webkit-scrollbar-track) {
		background: var(--panel);
	}

	:global(::-webkit-scrollbar-thumb) {
		background: var(--border);
		border-radius: 6px;
	}

	:global(::-webkit-scrollbar-thumb:hover) {
		background: var(--accent-dim);
	}
</style>
