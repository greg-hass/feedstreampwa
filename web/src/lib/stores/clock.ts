import { readable } from 'svelte/store';

const TICK_INTERVAL_MS = 30 * 1000;

export const now = readable(Date.now(), (set) => {
    set(Date.now());
    const timer = setInterval(() => set(Date.now()), TICK_INTERVAL_MS);
    return () => clearInterval(timer);
});
