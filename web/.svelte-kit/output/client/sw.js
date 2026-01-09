// FeedStream Service Worker
const CACHE_NAME = 'feedstream-v1';

self.addEventListener('install', (event) => {
    console.log('Service Worker installing.');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker activating.');
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Let all requests pass through for now
    // Future: implement caching strategy
});
