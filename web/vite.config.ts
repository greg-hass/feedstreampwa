import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

const shouldSilenceSvelteWarning = (message: string) => {
	if (
		message.includes('is not exported by "node_modules/svelte/src/runtime') &&
		(message.includes('"untrack"') || message.includes('"fork"') || message.includes('"settled"'))
	) {
		return true;
	}

	return false;
};

const svelteKitWarningFilter = () => ({
	name: 'sveltekit-warning-filter',
	configResolved(config: any) {
		const rollupOptions = config.build?.rollupOptions ?? {};
		const originalOnwarn = rollupOptions.onwarn;

		rollupOptions.onwarn = (warning: any, defaultHandler: (warning: any) => void) => {
			const message = String(warning?.message || '');
			if (warning?.code === 'MISSING_EXPORT' && shouldSilenceSvelteWarning(message)) {
				return;
			}

			if (typeof originalOnwarn === 'function') {
				originalOnwarn(warning, defaultHandler);
			} else {
				defaultHandler(warning);
			}
		};

		if (config.build) {
			config.build.rollupOptions = rollupOptions;
		} else {
			config.build = { rollupOptions };
		}
	}
});

export default defineConfig({
	plugins: [
		sveltekit(),
		SvelteKitPWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'sw.js',
			registerType: 'autoUpdate',
			includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
			injectManifest: {
				swSrc: 'src/service-worker.js'
			},
			manifest: {
				name: 'FeedStream',
				short_name: 'FeedStream',
				description: 'Your Personal RSS & Media Aggregator',
				theme_color: '#18181b',
				background_color: '#18181b',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'pwa-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'pwa-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					}
				],
				share_target: {
					action: "/share",
					method: "GET",
					enctype: "application/x-www-form-urlencoded",
					params: {
						title: "title",
						text: "text",
						url: "url"
					}
				}
			},
		}),
		svelteKitWarningFilter()
	],
	              test: {
	                      environment: 'jsdom',
	                      globals: true,
	                      setupFiles: ['src/test/setup.ts']
	              }
	       } as any);
