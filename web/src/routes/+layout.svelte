<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import '../app.css';

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
