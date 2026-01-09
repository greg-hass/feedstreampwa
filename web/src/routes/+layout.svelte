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
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
		color: #e4e4e4;
		min-height: 100vh;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>
